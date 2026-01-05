import { spawn } from 'child_process';

/**
 * Parse --help output into ATIP metadata
 *
 * This is a best-effort parser - results should be reviewed and refined.
 */

export class HelpParser {
  constructor(toolName) {
    this.toolName = toolName;
  }

  /**
   * Run tool --help and parse output
   */
  async parse() {
    const helpText = await this.getHelpText();
    const version = await this.getVersion();

    const metadata = {
      atip: { version: "0.4" },
      name: this.toolName,
      version: version || "unknown",
      description: this.extractDescription(helpText),
      trust: {
        source: "inferred",
        verified: false
      },
      commands: this.extractCommands(helpText),
    };

    return metadata;
  }

  /**
   * Get --help output from tool
   */
  async getHelpText(subcommand = null) {
    const args = subcommand ? subcommand.split(' ') : [];
    args.push('--help');

    return new Promise((resolve, reject) => {
      const proc = spawn(this.toolName, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', data => stdout += data);
      proc.stderr.on('data', data => stderr += data);

      proc.on('close', (code) => {
        // Many tools output help to stderr
        resolve(stdout || stderr);
      });

      proc.on('error', reject);

      setTimeout(() => {
        proc.kill();
        reject(new Error('Timeout'));
      }, 5000);
    });
  }

  /**
   * Get version (try --version, -v, version, etc.)
   */
  async getVersion() {
    const versionFlags = ['--version', '-v', 'version'];

    for (const flag of versionFlags) {
      try {
        const output = await new Promise((resolve, reject) => {
          const proc = spawn(this.toolName, [flag], {
            stdio: ['ignore', 'pipe', 'pipe']
          });

          let stdout = '';
          let stderr = '';

          proc.stdout.on('data', data => stdout += data);
          proc.stderr.on('data', data => stderr += data);

          proc.on('close', () => resolve(stdout || stderr));
          proc.on('error', reject);

          setTimeout(() => {
            proc.kill();
            reject(new Error('Timeout'));
          }, 2000);
        });

        const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
        if (versionMatch) {
          return versionMatch[1];
        }
      } catch (e) {
        continue;
      }
    }

    return null;
  }

  /**
   * Extract description from help text
   */
  extractDescription(helpText) {
    const lines = helpText.split('\n').filter(l => l.trim());

    // Usually first non-empty line
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      // Clean up common patterns
      return firstLine
        .replace(/^Usage:?\s*/i, '')
        .replace(/^\w+ - /, '')
        .split('\n')[0]
        .slice(0, 200);
    }

    return `${this.toolName} command-line tool`;
  }

  /**
   * Extract commands from help text
   */
  extractCommands(helpText) {
    const commands = {};
    const sections = this.findCommandSections(helpText);

    for (const section of sections) {
      const parsedCommands = this.parseCommandSection(section);
      Object.assign(commands, parsedCommands);
    }

    return commands;
  }

  /**
   * Find sections that list commands
   */
  findCommandSections(helpText) {
    const sections = [];
    const lines = helpText.split('\n');

    const sectionHeaders = [
      /^(COMMANDS|CORE COMMANDS|SUBCOMMANDS|AVAILABLE COMMANDS|USAGE)/i,
      /^(GENERAL COMMANDS|TARGETED COMMANDS|ADDITIONAL COMMANDS)/i,
      /^(GITHUB ACTIONS COMMANDS)/i
    ];

    let currentSection = null;
    let sectionLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this is a section header
      const isHeader = sectionHeaders.some(re => re.test(line.trim()));

      if (isHeader) {
        // Save previous section
        if (currentSection && sectionLines.length > 0) {
          sections.push({
            header: currentSection,
            lines: sectionLines
          });
        }

        currentSection = line.trim();
        sectionLines = [];
      } else if (currentSection) {
        // Check if we've hit a new major section (FLAGS, EXAMPLES, etc.)
        if (line.match(/^[A-Z][A-Z\s]+$/) && !line.match(/^\s/)) {
          // End of command section
          if (sectionLines.length > 0) {
            sections.push({
              header: currentSection,
              lines: sectionLines
            });
          }
          currentSection = null;
          sectionLines = [];
        } else {
          sectionLines.push(line);
        }
      }
    }

    // Save last section
    if (currentSection && sectionLines.length > 0) {
      sections.push({
        header: currentSection,
        lines: sectionLines
      });
    }

    return sections;
  }

  /**
   * Parse a command section
   */
  parseCommandSection(section) {
    const commands = {};

    for (const line of section.lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Match:  "commandname:  Description text"
      const match = trimmed.match(/^([a-z0-9-]+):\s+(.+)$/i);

      if (match) {
        const [, name, desc] = match;
        commands[name] = {
          description: desc.trim(),
          effects: this.inferEffects(name, desc)
        };
      }
    }

    return commands;
  }

  /**
   * Infer effects from command name and description
   */
  inferEffects(name, description) {
    const text = (name + ' ' + description).toLowerCase();

    const effects = {
      network: false,
      idempotent: true,
      reversible: false,
      destructive: false
    };

    // Tool-specific heuristics
    if (this.toolName === 'gh') {
      // GitHub CLI - almost everything needs network
      // Exceptions: completion (generates shell scripts locally)
      if (name === 'completion') {
        effects.network = false;
      } else {
        effects.network = true;
      }
    }

    if (this.toolName === 'kubectl') {
      // Kubernetes - most operations are network
      if (!text.match(/\b(completion|explain|version)\b/)) {
        effects.network = true;
      }
    }

    if (this.toolName === 'docker') {
      // Docker - network for registry operations
      if (text.match(/\b(pull|push|login|search|registry)\b/)) {
        effects.network = true;
      }
    }

    // Generic network indicators
    if (text.match(/\b(api|http|request|fetch|pull|push|clone|sync|upload|download|remote|server|github|gitlab|cloud)\b/)) {
      effects.network = true;
    }

    // Manage/work with cloud resources usually means network
    if (text.match(/\b(manage|work with)\b/) &&
        text.match(/\b(github|repository|repositories|pull request|issue|gist|codespace|release|project|secret|ssh|gpg)\b/)) {
      effects.network = true;
    }

    // Destructive indicators
    if (text.match(/\b(delete|remove|destroy|drop|purge|prune|force)\b/)) {
      effects.destructive = true;
      effects.idempotent = false;
      effects.reversible = false;
    }

    // Create/modify indicators
    if (text.match(/\b(create|add|new|edit|update|modify|set|merge|comment)\b/)) {
      effects.idempotent = false;
    }

    // Read-only indicators
    if (text.match(/\b(list|show|view|get|display|status|info|describe|search|browse|watch|read)\b/)) {
      effects.idempotent = true;
      effects.reversible = true;
    }

    // Reversible operations (paired actions)
    if (text.match(/\b(close|lock|disable|archive)\b/)) {
      // Check if description mentions the reverse operation
      if (text.match(/\b(reopen|unlock|enable|unarchive)\b/)) {
        effects.reversible = true;
      }
    }

    // Authentication is usually not destructive but not idempotent
    if (text.match(/\b(auth|authenticate|login)\b/)) {
      effects.destructive = false;
      effects.idempotent = false;
      effects.network = true;
    }

    return effects;
  }

  /**
   * Parse subcommand help recursively
   */
  async parseSubcommand(parentPath, commandName) {
    try {
      const fullPath = parentPath ? `${parentPath} ${commandName}` : commandName;
      const helpText = await this.getHelpText(fullPath);

      const command = {
        description: this.extractDescription(helpText),
        options: this.extractOptions(helpText),
        effects: this.inferEffects(commandName, helpText)
      };

      // Check if this command has subcommands
      const subcommands = this.extractCommands(helpText);
      if (Object.keys(subcommands).length > 0) {
        command.commands = subcommands;
      }

      return command;
    } catch (error) {
      // If we can't get help for a subcommand, return minimal info
      return {
        description: `${commandName} command`,
        effects: { idempotent: true }
      };
    }
  }

  /**
   * Extract options/flags from help text
   */
  extractOptions(helpText) {
    const options = [];
    const flagsSection = this.extractSection(helpText, /^FLAGS/i);

    if (!flagsSection) return options;

    const lines = flagsSection.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.match(/^FLAGS/i)) continue;

      // Match patterns like:
      //   -a, --assignee login       Description text
      //   --base branch              Description text
      //   -t, --title string         Description text
      const match = trimmed.match(/^((?:-\w,?\s*)?--[\w-]+)(?:\s+(\w+))?\s+(.+)$/);

      if (match) {
        const [, flagsRaw, argType, desc] = match;
        const flags = flagsRaw.split(',').map(f => f.trim()).filter(Boolean);
        const name = flags[flags.length - 1].replace(/^--/, '');

        options.push({
          name,
          flags,
          type: this.inferType(argType, desc),
          description: desc.trim(),
          required: false
        });
      }
    }

    return options;
  }

  /**
   * Extract a section from help text
   */
  extractSection(helpText, headerRegex) {
    const lines = helpText.split('\n');
    let inSection = false;
    let sectionLines = [];

    for (const line of lines) {
      if (headerRegex.test(line.trim())) {
        inSection = true;
        continue;
      }

      if (inSection) {
        // Stop at next major section
        if (line.match(/^[A-Z][A-Z\s]+$/) && !line.match(/^\s/)) {
          break;
        }
        sectionLines.push(line);
      }
    }

    return sectionLines.join('\n');
  }

  /**
   * Infer parameter type from argument name and description
   */
  inferType(argType, description) {
    if (!argType) return 'boolean';

    const argLower = argType.toLowerCase();
    const descLower = description.toLowerCase();

    if (argLower === 'string' || argLower === 'text') return 'string';
    if (argLower === 'number' || argLower === 'int') return 'integer';
    if (argLower === 'file' || descLower.includes('file')) return 'file';
    if (argLower === 'url' || descLower.includes('url')) return 'url';
    if (argLower === 'directory' || argLower === 'dir') return 'directory';

    return 'string';
  }
}
