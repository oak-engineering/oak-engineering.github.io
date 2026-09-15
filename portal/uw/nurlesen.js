(function(){
  var s = document.getElementById('stift');
  if(s && s.parentNode) s.parentNode.removeChild(s);
  document.body.classList.remove('bearbeiten');
})();