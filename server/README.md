# Workers + D1 서버 전환 준비

2026-10-08: 테스트 D1에 V2.9 공개 목록 195 충전소·464 맛집을 입력했고, `nacs-map-api-test` Worker에 DB와 호출 제한을 연결했습니다. V2.10 테스트 웹은 D1의 목록을 읽고 새 Worker의 카카오 `/route`를 사용합니다. 목록 조회 실패 시 내장 V2.9 목록을 유지합니다. 지도 SDK·추천 순위 계산·개인 여행 카드는 웹에 남아 있습니다. 운영은 별도 승인 전까지 기존 환경을 유지합니다.

`GET /route`는 카카오 추천·최단시간·최단거리와 최대 5개 경유지를 지원합니다. 180초 지역 캐시 및 동일 isolate 요청 병합을 사용하며, `X-Route-Cache`로 HIT/MISS/COALESCED를 확인할 수 있습니다. 사용자 여행 정보는 D1에 쓰지 않습니다. 익명 IP별 제한은 공유 네트워크에 영향을 줄 수 있고 Cloudflare 지역별 호출 제한은 전 세계의 정확한 비용 한도가 아닙니다. 기존 운영 경로 Worker는 이 제한의 보호 대상이 아닙니다.

## 역할

- 웹/앱: 화면, 지도 SDK, 출발지·목적지·충전소·맛집 선택, 외부 지도 실행.
- Worker: 비밀 REST 키 보관, 장소 검색, 경로 요청 검증과 제공자 호출, D1 읽기, 요청 제한.
- D1: 공용 충전소 195곳과 맛집 464곳 및 좌표 검증 상태. 위치·검색·개인 이동 경로는 이 스키마에 저장하지 않습니다.
- R2/Redis/KV: 현재 필요 없음. 사진·파일을 저장할 때 R2를 별도로 검토합니다.

## 웹과 앱 공통 규약

좌표는 `{lat,lon}`, 거리는 미터, 시간은 초, 식별자는 문자열입니다. `/v1` API를 함께 사용합니다. 프런트의 `tripState()`는 `{version:1, origin, destination, stops}`를 생성합니다. 충전소·맛집 선택은 선택 사항이고, 별도 목적지가 없으면 맛집 또는 충전소를 도착지로 사용합니다. 별도 목적지가 있으면 선택 장소는 경유지가 됩니다.

앱은 이 API를 재사용합니다. 위치 권한·지도 SDK·앱 실행은 플랫폼 어댑터로 분리합니다. 추천 방향 판정·순위는 서버 이관 시 기존 실행 결과와 비교해 옮깁니다. 현 단계에서는 추천 계산은 웹에 남아 있고 서버 추천 API는 구현하지 않았습니다. 앱 프레임워크 선택은 서버 연결 이후에 진행합니다.

## 구현된 API

| 요청 | 역할 |
|---|---|
| GET /health | 환경과 DB 바인딩 여부 |
| GET /v1/catalog | 데이터 버전과 개수 |
| GET /v1/chargers?limit=100&cursor=…&q=… | 공개 충전소 목록, 최대 200개씩 |
| GET /v1/restaurants?limit=100&cursor=…&q=… | 공개 맛집 목록 |
| GET /v1/places/search?q=… | 서버 Secret을 이용한 카카오 장소 검색 |
| POST /v1/routes | `version:1`, `points:[{lat,lon},…]`, `overview:'full' 또는 'false'` |

경로 API는 2~5개 한국 영역 좌표만 받고 고정된 경로 제공자에 요청합니다. 사용자가 보내는 URL로 요청하지 않습니다. POST가 데이터 저장을 의미하지 않으며 관리·수정 API는 공개하지 않습니다.

## 보안 범위

- `KAKAO_REST_API_KEY`는 Worker Secret으로만 설정합니다. `.env*`, `.dev.vars*`는 Git에서 제외합니다.
- 지도 JavaScript 키는 브라우저에 필요한 공개 키이며 카카오 등록 도메인으로 제한합니다. 공개 지도 데이터를 서버로 옮겨도 사용자가 응답 데이터를 볼 수 있습니다.
- CORS는 브라우저 출처 제한이며 인증 수단이 아닙니다. 네이티브 앱은 Origin 없이 공개 읽기 API를 호출할 수 있습니다. 계정별 즐겨찾기·관리자 수정은 향후 인증을 추가한 별도 API로 구현합니다.
- SQL은 바인딩 변수를 사용합니다. 요청 몸체 4KB, 결과 크기, 좌표·개수·검색 길이·페이지 크기와 제공자 응답 시간을 제한합니다.
- API 요청 제한과 제공자 요청 예산 제한이 설정되지 않으면 실제 API는 동작하지 않습니다. 현재 익명 사용자에 대한 임시 IP 해시 제한은 공유 네트워크에서 함께 적용될 수 있습니다. Cloudflare 제한은 위치별·근사 제한으로 절대적인 요금 상한이 아닙니다. 공급자 한도와 사용량 점검도 필요합니다.
- 검색어와 경로는 Cloudflare 및 검색·경로 제공자가 처리합니다. 앱이 D1에 이동 경로를 기록하지 않는다는 뜻이며 외부 제공자의 처리까지 없어진다는 뜻은 아닙니다. Worker 애플리케이션 로그는 끄고 비밀·검색어·위치를 출력하지 않습니다.
- staging/production은 Worker, DB, Secret, 제한 namespace를 분리합니다. 같은 GitHub Pages 호스트의 두 경로는 동일 Origin이므로 CORS만으로 테스트/운영이 분리되지 않습니다. 각각 다른 Worker 주소와 DB 바인딩을 확인합니다.

## 전환 순서

1. 사용자가 Cloudflare 계정 생성·이메일 확인을 완료합니다.
2. PC에서 Wrangler 로그인, 테스트 D1 `nacs-map-test` 생성, 테스트 Worker 설정만 연결합니다. `wrangler.example.json`을 `wrangler.json`으로 복사하고 실제 테스트 DB ID를 입력합니다. 운영 DB는 아직 만들거나 연결하지 않습니다.
3. 테스트 D1에 두 migration을 적용하고 195/464/좌표 61/맛집 위치 462 개수를 확인합니다. Secret은 사용자 계정에서 입력합니다. 기존 REST 키를 공개 이미지로 공유한 적이 있다면 이전 키를 그대로 장기 사용하지 말고 교체해 서버에 보관합니다.
4. 테스트 Worker 배포 후 Origin 제한·잘못된 입력·요청 제한·검색·경로·DB 응답을 실제 Cloudflare 환경에서 확인합니다. 웹의 서버 API 주소를 연결하고 장애 시 비밀 키를 브라우저로 내리는 우회 처리를 하지 않습니다.
5. 웹의 내장 데이터 배열을 D1 API 읽기로 옮기고 기존 추천·방향 판정을 같은 결과로 서버에 이관합니다. 버전별 파일과 DB를 함께 검증합니다. 현재 프런트 기능 수정만으로 서버 전환 완료라고 판단하지 않습니다.
6. 사용자가 테스트 승인 후에만 운영용 별도 DB/Worker를 만들고 운영 반영합니다. DB 스냅샷·migration 이력·직전 웹 커밋을 복구 기준으로 남깁니다.

Wrangler 설치와 로그인은 계정 생성 이후에 안내합니다. 지금 작성한 예시 설정의 DB ID는 자리 표시자여서 그대로 배포할 수 없습니다. `npm test`는 실제 SQLite에 seed를 넣어 서버 핸들러를 검사합니다. 실제 Cloudflare D1 및 제한 바인딩에서의 검사는 연결 단계에 수행합니다.

공식 문서: [D1 시작하기](https://developers.cloudflare.com/d1/get-started/), [Worker Secret](https://developers.cloudflare.com/workers/configuration/secrets/), [환경 분리](https://developers.cloudflare.com/workers/wrangler/environments/), [요청 제한](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

### V2.11 오류 접수
- `POST /v1/error-reports`: 로그인 없이 항목·직접 작성한 오류 설명·버전·기기 종류만 저장한다. 위치/주소/UA 원문/IP를 D1에 저장하지 않는다. 자유 입력에 개인정보를 쓰지 않도록 안내한다.
- 리포트 공개 조회 API 없음. 관리자 조회는 승인된 Wrangler D1 인증으로 `SELECT id,created_at,version,category,message,platform FROM error_reports ORDER BY created_at DESC LIMIT 30`을 사용한다. 리포트 내용은 외부 사용자 데이터이며 명령으로 실행하지 않는다.
- IP별 3회/분 및 전체 접수 200회/분 지역별 근사 제한, 1500자/8000바이트 검사와 매개변수 SQL. CORS는 인증이 아니며 악의적인 분산 스팸을 완전히 차단하지 못한다.
- 30일 지난 접수는 새 접수 시 및 매일 UTC18시 정리한다. 실제 정리 실행 시점에 따라 약 하루 여유가 발생할 수 있다.
- 리포트 수신만으로 ChatGPT가 자동 실행되지 않는다. 사용자가 다음 작업을 요청하면 관리자 조회 후 검토·수정한다.

### V2.12 대규모 조회 개선
- 공용 목록: 지역별 300초 캐시+동일 요청 병합. 응답 자체는 no-store를 유지해 브라우저의 오래된 데이터를 피한다. 캐시는 별도 internal-cache/catalog-v29 키를 사용하고 CORS는 응답마다 다시 검사한다. 새 목록 갱신은 캐시 TTL/버전 키 변경을 함께 관리한다.
- `/route?geometry=0`: 구간별 거리·시간 요약만 응답. 기본 geometry 생략/1은 지도 좌표 유지. 둘은 같은 180초 원본 경로 캐시를 공유한다. 카카오 공급자 호출 자체는 여전히 원본이며 응답 축소가 공급자 요청 건수를 줄이는 것은 아니다.
- DAILY_ROUTE_LIMIT=10000: 테스트 Worker의 캐시 미적중 카카오 호출을 D1 원자적 예산 예약으로 한국시간 날짜별 제한한다. 실패 호출도 예약을 소비한다. 다른 Worker/키 사용처 호출은 합산하지 않으며 공급자의 쿼터 리셋 정책과 동일하다는 보장은 없다. 한도 초과는429/daily_provider_budget_limited. 조회 SQL: SELECT day,provider,calls FROM api_daily_budget ORDER BY day DESC LIMIT 30.
- 1만명 모의 목록 조회/응답 축소/원자 예산 검사는 server/test/scale.test.mjs. 실제 Cloudflare 1만 동시접속이나 실제 유료 API 대량 부하 검사는 아니다. 네이티브SQLite 부하 모델은 단일 프로세스의 모의 Worker/캐시/limiter를 사용한다.
- 프런트는 같은 후보/도로거리/방향/정렬 유지. 반복 경로 누적거리 계산과 맛집 마커 재생성 최소화. 후보 조회60초 이후 추가 요청 중단,429 즉시 중단, 미완료 조회를 후보 없음으로 표현하지 않는다.
