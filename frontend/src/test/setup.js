// Setup jsdom environment polyfills and stubs
if (typeof window !== 'undefined') {
  window.alert = window.alert || (() => {});
  window.confirm = window.confirm || (() => true);
  window.scrollTo = window.scrollTo || (() => {});
}
