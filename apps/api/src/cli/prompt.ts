/** Ctrl+C mientras se escribe una contraseña: el comando termina sin hacer cambios */
export class CancelledError extends Error {}

/** Lee una línea sin mostrarla: cada carácter se ve como "*" */
export function askHidden(question: string): Promise<string> {
  const { stdin, stdout } = process;
  return new Promise((resolve, reject) => {
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    stdin.resume();

    let value = '';
    const finish = (error?: Error) => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u0003') return finish(new CancelledError('Cancelado.')); // Ctrl+C
        if (char === '\u007f' || char === '\b') {
          if (value) {
            value = value.slice(0, -1);
            stdout.write('\b \b');
          }
        } else if (char >= ' ') {
          value += char;
          stdout.write('*');
        }
      }
    };
    stdin.on('data', onData);
  });
}
