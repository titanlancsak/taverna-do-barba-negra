const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

const trackList = document.getElementById('track-list');
const audioPlayer = document.getElementById('audio-player');
const nowPlaying = document.getElementById('now-playing');

async function loadTracks() {
  try {
    const response = await fetch(`${API_BASE}/api/music/list`);
    const tracks = await response.json();

    if (!tracks.length) {
      trackList.innerHTML = '<li>No tracks available yet.</li>';
      return;
    }

    tracks.forEach(track => {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = `▶ ${track.title}`;
      link.addEventListener('click', (e) => {
        e.preventDefault();
        playTrack(track);
      });
      li.appendChild(link);
      trackList.appendChild(li);
    });
  } catch (err) {
    trackList.innerHTML = '<li>Could not load tracks.</li>';
    console.error(err);
  }
}

function playTrack(track) {
  audioPlayer.src = `../assets/music/${track.file}`;
  audioPlayer.play();
  nowPlaying.textContent = `Now playing: ${track.title}`;
}

loadTracks();
