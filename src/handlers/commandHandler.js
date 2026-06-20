const fs = require('node:fs');
const path = require('node:path');

function loadCommands() {
  const commands = new Map();
  const commandsPath = path.join(__dirname, '..', 'commands');

  const entries = fs.readdirSync(commandsPath, { withFileTypes: true });

  for (const entry of entries) {
    const filePath = path.join(commandsPath, entry.name);

    if (entry.isDirectory()) {
      for (const file of fs.readdirSync(filePath).filter((f) => f.endsWith('.js'))) {
        const command = require(path.join(filePath, file));
        if (command.data && command.execute) {
          commands.set(command.data.name, command);
        }
      }
      continue;
    }

    if (entry.name.endsWith('.js')) {
      const command = require(filePath);
      if (command.data && command.execute) {
        commands.set(command.data.name, command);
      }
    }
  }

  return commands;
}

module.exports = { loadCommands };
