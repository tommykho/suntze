// Runs before first paint: enable motion styles only when JS works and the user allows motion.
(function () {
  var d = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) d.classList.add('has-motion');
  // Safety net: if the motion bundle fails to load, show everything.
  setTimeout(function () { if (!d.classList.contains('motion-ready')) d.classList.remove('has-motion'); }, 3500);
})();
