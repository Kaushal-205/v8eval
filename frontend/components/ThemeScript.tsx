export function ThemeScript() {
  const script = `
    (function () {
      var saved = localStorage.getItem('v8eval-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', saved || (prefersDark ? 'dark' : 'light'));
    })();
  `
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
