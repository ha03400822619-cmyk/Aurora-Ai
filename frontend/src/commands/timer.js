export const timerCommand = {
  name: 'timer',
  description: 'Pomodoro / Focus timer',
  icon: '⏱',
  
  execute(input) {
    if (!input || input.trim() === '') {
      return {
        success: false,
        error: 'Please provide a duration in minutes. Example: /timer 25'
      };
    }

    try {
      const minutes = parseInt(input.replace(/^timer\s*/i, '').trim());
      
      if (isNaN(minutes) || minutes <= 0) {
        return {
          success: false,
          error: 'Please provide a valid positive number of minutes'
        };
      }

      if (minutes > 120) {
        return {
          success: false,
          error: 'Maximum timer duration is 120 minutes'
        };
      }

      const totalSeconds = minutes * 60;
      
      return {
        success: true,
        duration: {
          minutes,
          seconds: totalSeconds,
          display: this.formatDuration(totalSeconds)
        },
        type: 'timer_start'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Invalid timer input'
      };
    }
  },

  formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  },

  // Timer control actions
  pause() {
    return {
      success: true,
      action: 'pause',
      type: 'timer_control'
    };
  },

  resume() {
    return {
      success: true,
      action: 'resume',
      type: 'timer_control'
    };
  },

  reset() {
    return {
      success: true,
      action: 'reset',
      type: 'timer_control'
    };
  }
};
