(function () {
  var dialog = document.getElementById('lightbox');
  if (!dialog || typeof dialog.showModal !== 'function') return; // without support the links open the large image

  var links = Array.prototype.slice.call(document.querySelectorAll('.g-grid a.g-item'));
  if (!links.length) return;

  var img = dialog.querySelector('.lb-img');
  var count = dialog.querySelector('.lb-count');
  var caption = dialog.querySelector('.lb-alt');
  var index = 0;
  var opener = null;

  function wrap(i) { return (i + links.length) % links.length; }

  function preload(i) {
    new Image().src = links[wrap(i)].getAttribute('href');
  }

  function show(i) {
    index = wrap(i);
    var link = links[index];
    var thumb = link.querySelector('img');
    img.src = link.getAttribute('href');
    img.alt = thumb ? thumb.alt : '';
    count.textContent = (index + 1) + ' / ' + links.length;
    caption.textContent = img.alt;
    preload(index + 1);
    preload(index - 1);
  }

  links.forEach(function (link, i) {
    link.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // let "open in new tab" work
      e.preventDefault();
      opener = link;
      show(i);
      dialog.showModal();
    });
  });

  dialog.querySelector('.lb-close').addEventListener('click', function () { dialog.close(); });
  dialog.querySelector('.lb-prev').addEventListener('click', function () { show(index - 1); });
  dialog.querySelector('.lb-next').addEventListener('click', function () { show(index + 1); });

  dialog.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
  });

  // Click on the dark area around the picture closes it.
  dialog.addEventListener('click', function (e) {
    if (e.target === dialog || e.target.classList.contains('lb-stage')) dialog.close();
  });

  // Swipe left/right on touch screens.
  var startX = null;
  dialog.addEventListener('touchstart', function (e) { startX = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  dialog.addEventListener('touchend', function (e) {
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
  }, { passive: true });

  dialog.addEventListener('close', function () {
    if (dialog.open) return; // a late 'close' event must not wipe a lightbox that was reopened meanwhile
    img.removeAttribute('src');
    if (opener) opener.focus();
  });
})();
