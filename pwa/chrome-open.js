(() => {
  const button = document.getElementById('chromeOpenButton');
  const dialog = document.getElementById('chromeOpenDialog');
  const guide = document.getElementById('chromeOpenGuide');
  const link = document.getElementById('chromeOpenLink');
  // Use this site's path, never passwords, session tokens or arbitrary destinations.
  const url = new URL(location.pathname + location.hash, location.origin);
  const android = /Android/i.test(navigator.userAgent);
  button.addEventListener('click', () => {
    link.hidden = !android;
    if (android) {
      link.href = 'intent://' + url.host + url.pathname + url.hash.replace(/^#/, '%23') + '#Intent;scheme=https;action=android.intent.action.VIEW;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(url.href) + ';end';
      guide.textContent = '아래 버튼을 눌러 Chrome으로 열어주세요. 앱 선택 화면이 나오면 Chrome을 선택하세요. 테스트 페이지는 다시 로그인해야 할 수 있습니다.';
    } else {
      guide.textContent = /iPhone|iPad|iPod/i.test(navigator.userAgent)
        ? '브라우저 메뉴에서 외부 브라우저로 열기를 선택하거나, 주소를 복사해 Chrome 또는 Safari에서 열어주세요.'
        : '현재 페이지 주소를 복사해 Chrome 주소창에서 열어주세요.';
    }
    if (!dialog.open) dialog.showModal();
  });
  document.getElementById('chromeOpenClose').addEventListener('click', () => dialog.close());
})();
