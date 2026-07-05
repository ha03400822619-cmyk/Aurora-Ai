import { timerCommand } from './timer.js';
import { todoCommand } from './todo.js';
import { gpaCommand } from './gpa.js';

export const COMMANDS = {
  timer: timerCommand,
  todo: todoCommand,
  gpa: gpaCommand
};

export const COMMAND_LIST = Object.values(COMMANDS).map(cmd => ({
  name: cmd.name,
  description: cmd.description,
  icon: cmd.icon
}));

export function isCommand(input) {
  return input && input.trim().startsWith('/');
}

export function parseCommand(input) {
  if (!isCommand(input)) {
    return null;
  }

  const trimmed = input.trim();
  const spaceIndex = trimmed.indexOf(' ');
  
  if (spaceIndex === -1) {
    // Command with no arguments
    return {
      name: trimmed.substring(1).toLowerCase(),
      args: ''
    };
  }
  
  // Command with arguments
  return {
    name: trimmed.substring(1, spaceIndex).toLowerCase(),
    args: trimmed.substring(spaceIndex + 1).trim()
  };
}

export function executeCommand(input) {
  const parsed = parseCommand(input);
  
  if (!parsed) {
    return {
      success: false,
      error: 'Invalid command format'
    };
  }

  const command = COMMANDS[parsed.name];
  
  if (!command) {
    return {
      success: false,
      error: `Unknown command: /${parsed.name}. Available commands: ${Object.keys(COMMANDS).map(cmd => '/' + cmd).join(', ')}`
    };
  }

  try {
    const result = command.execute(parsed.args);
    
    return {
      success: true,
      command: parsed.name,
      icon: command.icon,
      description: command.description,
      ...result
    };
  } catch (error) {
    return {
      success: false,
      error: `Command execution failed: ${error.message}`,
      command: parsed.name
    };
  }
}

export function getCommandSuggestions(partialInput) {
  if (!partialInput || !partialInput.startsWith('/')) {
    return [];
  }

  const search = partialInput.substring(1).toLowerCase();
  
  return COMMAND_LIST.filter(cmd => 
    cmd.name.toLowerCase().startsWith(search)
  ).map(cmd => ({
    ...cmd,
    command: `/${cmd.name}`
  }));
}
