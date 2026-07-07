// Serializa operações Playwright para evitar conflito em requisições simultâneas.

let chain = Promise.resolve();

function enqueue(task) {
  const run = chain.then(task, task);
  chain = run.catch(() => {});
  return run;
}

module.exports = { enqueue };
