(function() {
  'use strict';

  EicerikWidget.ready();

  var props = EicerikWidget.getProps();
  var min = Math.max(1, Number(props.min || 1));
  var max = Math.max(min, Number(props.max || 10));
  var animated = props.animated !== false;

  var diceFace = document.getElementById('diceFace');
  var rollButton = document.getElementById('rollButton');
  var isRolling = false;

  function rollDice() {
    if (isRolling) return;
    isRolling = true;

    if (animated && diceFace) {
      diceFace.classList.add('rolling');
    }

    var duration = animated ? 600 : 50;
    var intervalTime = animated ? 80 : 10;
    var elapsed = 0;

    var interval = setInterval(function() {
      elapsed += intervalTime;
      if (diceFace) {
        diceFace.textContent = String(Math.floor(Math.random() * (max - min + 1)) + min);
      }
      if (elapsed >= duration) {
        clearInterval(interval);
        var value = Math.floor(Math.random() * (max - min + 1)) + min;
        if (diceFace) {
          diceFace.textContent = String(value);
          diceFace.classList.remove('rolling');
        }
        isRolling = false;
        EicerikWidget.emit('diceRolled', { value: value });
      }
    }, intervalTime);
  }

  EicerikWidget.onCommand('roll', rollDice);
  EicerikWidget.onCommand('reset', function() {
    if (diceFace) diceFace.textContent = '?';
  });

  if (rollButton) {
    rollButton.addEventListener('click', rollDice);
  }
})();
