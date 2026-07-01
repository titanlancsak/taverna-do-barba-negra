document.querySelectorAll('.copy-btn').forEach(button => {
  button.addEventListener('click', () => {
    const code = button.previousElementSibling.textContent;
    navigator.clipboard.writeText(code).then(() => {
      const original = button.textContent;
      button.textContent = 'Copied!';
      setTimeout(() => { button.textContent = original; }, 1500);
    });
  });
});
