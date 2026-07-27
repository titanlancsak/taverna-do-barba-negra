// Gera QR code 100% no navegador usando a lib qrcode-generator (js/vendor/qrcode.js).
const form = document.getElementById('qr-form');
const input = document.getElementById('qr-input');
const eccSelect = document.getElementById('ecc-select');
const statusMessage = document.getElementById('status-message');
const result = document.getElementById('qr-result');
const image = document.getElementById('qr-image');
const download = document.getElementById('qr-download');

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const text = input.value.trim();
  if (!text) {
    statusMessage.textContent = 'まずリンクかテキストを入力してください。';
    result.hidden = true;
    return;
  }

  try {
    // タイプ 0 = データ量に応じて自動サイズ調整
    const qr = qrcode(0, eccSelect.value);
    qr.addData(text);
    qr.make();

    // createDataURL(セルサイズ, 余白) -> PNG の data URL
    const dataUrl = qr.createDataURL(8, 16);
    image.src = dataUrl;
    download.href = dataUrl;
    result.hidden = false;
    statusMessage.textContent = '生成しました！';
  } catch (err) {
    console.error(err);
    statusMessage.textContent = 'テキストが長すぎます。もっと短い内容でお試しください。';
    result.hidden = true;
  }
});
