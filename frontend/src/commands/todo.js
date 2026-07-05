export const todoCommand = {
  name: 'todo',
  description: 'Task manager - add, complete, and manage tasks',
  icon: '📝',
  
  execute(input) {
    if (!input || input.trim() === '') {
      return this.showTasks();
    }

    const action = input.replace(/^todo\s*/i, '').trim();
    
    // Handle different todo actions
    if (action.startsWith('add ')) {
      return this.addTask(action.substring(4));
    } else if (action.startsWith('complete ') || action.startsWith('done ')) {
      const taskId = action.substring(action.indexOf(' ') + 1);
      return this.completeTask(taskId);
    } else if (action.startsWith('delete ') || action.startsWith('remove ')) {
      const taskId = action.substring(action.indexOf(' ') + 1);
      return this.deleteTask(taskId);
    } else if (action === 'list' || action === 'show') {
      return this.showTasks();
    } else if (action === 'clear') {
      return this.clearTasks();
    } else {
      // Default: add the task
      return this.addTask(action);
    }
  },

  addTask(taskText) {
    if (!taskText || taskText.trim() === '') {
      return {
        success: false,
        error: 'Please provide a task description. Example: /todo Finish assignment'
      };
    }

    try {
      const tasks = this.getTasks();
      const newTask = {
        id: Date.now().toString(),
        text: taskText.trim(),
        completed: false,
        createdAt: new Date().toISOString()
      };
      
      tasks.push(newTask);
      this.saveTasks(tasks);
      
      return {
        success: true,
        action: 'add',
        task: newTask,
        message: 'Task added successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to add task'
      };
    }
  },

  completeTask(taskId) {
    try {
      const tasks = this.getTasks();
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      
      if (taskIndex === -1) {
        return {
          success: false,
          error: 'Task not found'
        };
      }

      tasks[taskIndex].completed = true;
      tasks[taskIndex].completedAt = new Date().toISOString();
      this.saveTasks(tasks);
      
      return {
        success: true,
        action: 'complete',
        task: tasks[taskIndex],
        message: 'Task marked as complete'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to complete task'
      };
    }
  },

  deleteTask(taskId) {
    try {
      const tasks = this.getTasks();
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      
      if (taskIndex === -1) {
        return {
          success: false,
          error: 'Task not found'
        };
      }

      const deletedTask = tasks.splice(taskIndex, 1)[0];
      this.saveTasks(tasks);
      
      return {
        success: true,
        action: 'delete',
        task: deletedTask,
        message: 'Task deleted'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to delete task'
      };
    }
  },

  showTasks() {
    try {
      const tasks = this.getTasks();
      
      if (tasks.length === 0) {
        return {
          success: true,
          action: 'list',
          tasks: [],
          message: 'No tasks yet. Add one with /todo Your task description'
        };
      }

      const completed = tasks.filter(t => t.completed);
      const pending = tasks.filter(t => !t.completed);
      
      return {
        success: true,
        action: 'list',
        tasks: {
          all: tasks,
          pending,
          completed,
          summary: {
            total: tasks.length,
            completed: completed.length,
            pending: pending.length
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to retrieve tasks'
      };
    }
  },

  clearTasks() {
    try {
      this.saveTasks([]);
      return {
        success: true,
        action: 'clear',
        message: 'All tasks cleared'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to clear tasks'
      };
    }
  },

  getTasks() {
    try {
      const stored = localStorage.getItem('aurora_todo_tasks');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  },

  saveTasks(tasks) {
    try {
      localStorage.setItem('aurora_todo_tasks', JSON.stringify(tasks));
    } catch (error) {
      console.error('Failed to save tasks:', error);
    }
  }
};
