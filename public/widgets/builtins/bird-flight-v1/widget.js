(function() {
  'use strict';

  EicerikWidget.ready();

  var props = EicerikWidget.getProps();
  var speed = Math.max(0.2, Math.min(3, Number(props.speed || 1)));
  var baseInterval = Math.round(250 / speed);

  var bird = document.getElementById('bird');
  var wingLeft = document.getElementById('wingLeft');
  var wingRight = document.getElementById('wingRight');
  var status = document.getElementById('status');

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function flapWings(up) {
    var cls = up ? 'flap-up' : 'flap-down';
    var rem = up ? 'flap-down' : 'flap-up';
    if (wingLeft) {
      wingLeft.classList.remove(rem);
      wingLeft.classList.add(cls);
    }
    if (wingRight) {
      wingRight.classList.remove(rem);
      wingRight.classList.add(cls);
    }
  }

  EicerikWidget.onCommand('flyWithFlaps', function(payload) {
    var flapCount = Math.max(1, Math.min(50, Number(payload.flapCount || 1)));
    var current = 0;
    var isUp = false;

    setStatus('Uçuş başladı: 0 / ' + flapCount);

    if (bird) {
      bird.style.bottom = '140px';
    }

    function step() {
      current += 1;
      isUp = !isUp;
      flapWings(isUp);

      setStatus('Kanat çırpma: ' + current + ' / ' + flapCount);

      EicerikWidget.emit('flapComplete', {
        current: current,
        total: flapCount
      });

      if (current < flapCount) {
        setTimeout(step, baseInterval);
        return;
      }

      // Landing
      setTimeout(function() {
        flapWings(false);
        if (bird) {
          bird.style.bottom = '90px';
        }
        setStatus('Uçuş tamamlandı');
        EicerikWidget.emit('flightComplete', {
          flapCount: flapCount
        });
      }, baseInterval);
    }

    step();
  });

  EicerikWidget.onCommand('reset', function() {
    if (bird) bird.style.bottom = '90px';
    flapWings(false);
    setStatus('Hazır');
  });
})();
