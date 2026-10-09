(() => {
  const button = document.getElementById('homeInstallButton');
  const dialog = document.getElementById('homeInstallDialog');
  const guide = document.getElementById('homeInstallGuide');
  const browserLink = document.getElementById('homeInstallBrowser');
  const standalone = window.matchMedia('(display-mode: standalone)');
  const samsung = /SamsungBrowser/i.test(navigator.userAgent);
  let pendingPrompt = null;
  const installed = () => standalone.matches || navigator.standalone === true;
  function chromeInstallUrl() {
    const url = new URL('../', document.querySelector('link[rel="manifest"]').href);
    return 'intent://' + url.host + url.pathname + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(url.href) + ';end';
  }
  const update = () => { button.hidden = installed(); };
  update();
  standalone.addEventListener?.('change', update);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    if (!samsung) pendingPrompt = event;
    if (dialog.open && !samsung) dialog.close();
  });
  window.addEventListener('appinstalled', () => {
    pendingPrompt = null;
    button.hidden = true;
    if (dialog.open) dialog.close();
  });
  function showGuide() {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const inApp = /KAKAOTALK|NAVER\(|Instagram|FBAN|FBAV|; wv\)/i.test(ua);
    const android = /Android/i.test(ua);
    browserLink.hidden = true;
    if (inApp) {
      guide.textContent = ios
        ? 'Safari에서 이 페이지를 연 뒤 공유 버튼 → 홈 화면에 추가를 눌러주세요.'
        : '외부 브라우저에서 열어주세요. Chrome 메뉴(⋮) → 홈 화면에 추가 또는 설치 및 바로가기 만들기 → 설치를 선택하세요.';
      if (android) {
        const url = new URL('../', document.querySelector('link[rel="manifest"]').href);
        browserLink.href = 'intent://' + url.host + url.pathname + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(url.href) + ';end';
        browserLink.hidden = false;
      }
    } else if (ios) {
      guide.textContent = '공유 버튼 → 홈 화면에 추가 → 추가를 눌러주세요. 메뉴가 보이지 않으면 Safari에서 열어주세요.';
    } else if (samsung) {
      guide.textContent = '앱 설치는 Chrome에서 진행합니다. 아래 버튼으로 Chrome을 연 뒤, 홈화면에 추가를 눌러 설치해 주세요.';
      browserLink.href = chromeInstallUrl();
      browserLink.textContent = 'Chrome으로 열기';
      browserLink.hidden = false;
    } else if (android) {
      guide.textContent = 'Chrome 메뉴(⋮) → 홈 화면에 추가 또는 설치 및 바로가기 만들기 → 설치를 눌러주세요. 설치 준비 중이라면 잠시 뒤 다시 시도하세요.';
    } else {
      guide.textContent = '주소창의 설치 아이콘이나 브라우저 메뉴의 앱 설치를 선택하세요. 스마트폰에서는 이 페이지를 열고 홈화면에 추가를 눌러주세요.';
    }
    if (!dialog.open) dialog.showModal();
  }
  button.addEventListener('click', async () => {
    if (samsung) { showGuide(); return; }
    if (!pendingPrompt) { showGuide(); return; }
    const prompt = pendingPrompt;
    pendingPrompt = null;
    button.disabled = true;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch { showGuide(); }
    finally { button.disabled = false; }
  });
  document.getElementById('homeInstallClose').addEventListener('click', () => dialog.close());
  // Network-only: never cache authenticated API responses, keys, or old application HTML.
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js', {scope: './'}).catch(() => {});
  }
})();
