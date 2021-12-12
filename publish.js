#!/usr/bin/env node

const shell = require('shelljs');

shell.config.fatal = true;
shell.config.globOptions.dot = true;

shell.rm('-rf', 'dist');
shell.exec('npm run build');

shell.rm('-rf', '.publish');
shell.mkdir('.publish');
shell.cd('.publish');
shell.cp('-r', '../.git', '.');

shell.exec('git checkout -f gh-pages');
shell.exec('git pull');
shell.rm('-rf', 'shb');
shell.mkdir('shb');
shell.cp('../dist/*', 'shb');
shell.touch('.nojekyll');

shell.exec('git add -A');
shell.exec('git commit -m "Publish"');
shell.exec('git push origin gh-pages');
shell.cd('..');
shell.rm('-rf', '.publish');
