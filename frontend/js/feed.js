const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

// Ícones (feed fica na home/raiz)
const HEART_EMPTY = 'assets/icons/heart-empty.svg';    // não curtido (cinza)
const HEART_LIKED = 'assets/icons/heart-liked.svg';    // curtido (dourado)
const COMMENT_EMPTY = 'assets/icons/comment-empty.svg'; // não comentou (cinza)
const COMMENT_DONE = 'assets/icons/comment-done.svg';   // comentou (amarelo)

const token = localStorage.getItem('taverna_token');
const currentUser = JSON.parse(localStorage.getItem('taverna_user') || 'null');

const postsContainer = document.getElementById('posts-container');
const postContentInput = document.getElementById('post-content-input');
const postMediaInput = document.getElementById('post-media-input');
const postSubmitBtn = document.getElementById('post-submit-btn');
const postStatusMessage = document.getElementById('post-status-message');
const postMediaFilename = document.getElementById('post-media-filename');

postContentInput.addEventListener('input', () => {
  postContentInput.style.height = 'auto';
  postContentInput.style.height = postContentInput.scrollHeight + 'px';
});

postMediaInput.addEventListener('change', () => {
  postMediaFilename.textContent = postMediaInput.files[0]?.name || '';
});

function timeAgo(dateString) {
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (seconds < 60) return 'たった今';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderPost(post) {
  const authorPic = post.author_picture ? `..${post.author_picture}` : 'assets/default-avatar.svg';
  const mediaHtml = post.media_url
    ? (post.media_type === 'video'
        ? `<video class="post-media" src="..${post.media_url}" controls></video>`
        : `<img class="post-media" src="..${post.media_url}" alt="投稿メディア">`)
    : '';

  return `
    <div class="post-card" data-post-id="${post.id}">
      <div class="post-header">
        <img class="post-author-pic" src="${authorPic}" alt="">
        <div>
          <div class="post-author-name">${escapeHtml(post.author_name)}</div>
          <div class="post-date">${timeAgo(post.created_at)}</div>
        </div>
      </div>
      ${post.content ? `<div class="post-content">${escapeHtml(post.content)}</div>` : ''}
      ${mediaHtml}
      <div class="post-actions">
        <button class="like-btn ${post.liked_by_me ? 'liked' : ''}" data-post-id="${post.id}">
          <img class="like-icon" src="${post.liked_by_me ? HEART_LIKED : HEART_EMPTY}" alt="いいね">
          <span class="like-count">${post.like_count}</span>
        </button>
        <button class="comment-toggle-btn" data-post-id="${post.id}">
          <img class="comment-icon" src="${post.commented_by_me ? COMMENT_DONE : COMMENT_EMPTY}" alt="コメント">
          <span class="comment-count">${post.comment_count}</span> コメント
        </button>
        ${currentUser && currentUser.id === post.author_id ? `<button class="post-delete-btn" data-post-id="${post.id}">🗑 削除</button>` : ''}
      </div>
      <div class="comments-box" data-post-id="${post.id}">
        <div class="comments-list"></div>
        ${token ? `
          <div class="comment-form">
            <input type="text" class="comment-input" placeholder="コメントを書く..." maxlength="500">
            <button class="comment-submit-btn" data-post-id="${post.id}">送信</button>
          </div>
        ` : '<p>コメントするには<a href="pages/login.html">ログイン</a>してください。</p>'}
      </div>
    </div>
  `;
}

let currentPage = 1;
let isLoadingMore = false;
let hasMorePosts = true;

async function loadFeed() {
  try {
    const response = await fetch(`${API_BASE}/api/feed/posts?page=1`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    const data = await response.json();

    hasMorePosts = data.hasMore;

    if (!data.posts.length) {
      postsContainer.innerHTML = '<p>まだ投稿がありません。最初の投稿をしましょう！</p>';
      return;
    }

    postsContainer.innerHTML = data.posts.map(renderPost).join('');
    attachPostListeners();
    setupInfiniteScroll();
  } catch (err) {
    console.error(err);
    postsContainer.innerHTML = '<p>フィードの読み込みに失敗しました。</p>';
  }
}

async function loadMorePosts() {
  if (isLoadingMore || !hasMorePosts) return;
  isLoadingMore = true;
  currentPage++;

  const loadingIndicator = document.createElement('p');
  loadingIndicator.id = 'loading-more-indicator';
  loadingIndicator.textContent = 'さらに投稿を読み込み中...';
  postsContainer.appendChild(loadingIndicator);

  try {
    const response = await fetch(`${API_BASE}/api/feed/posts?page=${currentPage}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    const data = await response.json();

    document.getElementById('loading-more-indicator')?.remove();

    hasMorePosts = data.hasMore;

    if (data.posts.length) {
      postsContainer.insertAdjacentHTML('beforeend', data.posts.map(renderPost).join(''));
      attachPostListeners();
    }
  } catch (err) {
    console.error(err);
    document.getElementById('loading-more-indicator')?.remove();
  } finally {
    isLoadingMore = false;
  }
}

function setupInfiniteScroll() {
  window.addEventListener('scroll', () => {
    const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 400;
    if (nearBottom) {
      loadMorePosts();
    }
  });
}

function attachPostListeners() {
  document.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', () => handleLike(btn));
  });

  document.querySelectorAll('.comment-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleComments(btn.dataset.postId));
  });

  document.querySelectorAll('.comment-submit-btn').forEach(btn => {
    btn.addEventListener('click', () => submitComment(btn.dataset.postId));
  });

  document.querySelectorAll('.post-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDeletePost(btn.dataset.postId));
  });
}

async function handleDeletePost(postId) {
  if (!confirm('この投稿を削除しますか？元に戻せません。')) return;

  try {
    const response = await fetch(`${API_BASE}/api/feed/posts/${postId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('投稿の削除に失敗しました');

    document.querySelector(`.post-card[data-post-id="${postId}"]`).remove();
  } catch (err) {
    console.error(err);
  }
}

async function handleLike(btn) {
  if (!token) {
    window.location.href = 'pages/login.html';
    return;
  }

  const postId = btn.dataset.postId;

  try {
    const response = await fetch(`${API_BASE}/api/feed/posts/${postId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    const countSpan = btn.querySelector('.like-count');
    const icon = btn.querySelector('.like-icon');
    let count = parseInt(countSpan.textContent);

    if (data.liked) {
      btn.classList.add('liked');
      if (icon) icon.src = HEART_LIKED;
      countSpan.textContent = count + 1;
    } else {
      btn.classList.remove('liked');
      if (icon) icon.src = HEART_EMPTY;
      countSpan.textContent = count - 1;
    }
  } catch (err) {
    console.error(err);
  }
}

async function toggleComments(postId) {
  const box = document.querySelector(`.comments-box[data-post-id="${postId}"]`);
  const isOpen = box.classList.contains('open');

  if (isOpen) {
    box.classList.remove('open');
    return;
  }

  box.classList.add('open');
  await loadComments(postId);
}

async function loadComments(postId) {
  const box = document.querySelector(`.comments-box[data-post-id="${postId}"]`);
  const list = box.querySelector('.comments-list');
  list.innerHTML = '<p>コメントを読み込み中...</p>';

  try {
    const response = await fetch(`${API_BASE}/api/feed/posts/${postId}/comments`);
    const data = await response.json();

    if (!data.comments.length) {
      list.innerHTML = '<p>まだコメントがありません。</p>';
      return;
    }

    list.innerHTML = data.comments.map(c => `
      <div class="comment-item" data-comment-id="${c.id}">
        <span class="comment-author">${escapeHtml(c.author_name)}</span>: ${escapeHtml(c.content)}
        ${currentUser && currentUser.id === c.user_id ? `<button class="comment-delete-btn" data-comment-id="${c.id}" data-post-id="${postId}">✕</button>` : ''}
      </div>
    `).join('');

    list.querySelectorAll('.comment-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => handleDeleteComment(btn.dataset.commentId, btn.dataset.postId));
    });
  } catch (err) {
    list.innerHTML = '<p>コメントの読み込みに失敗しました。</p>';
  }
}

async function handleDeleteComment(commentId, postId) {
  if (!confirm('このコメントを削除しますか？')) return;

  try {
    const response = await fetch(`${API_BASE}/api/feed/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('コメントの削除に失敗しました');

    await loadComments(postId);

    const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    const countSpan = card.querySelector('.comment-toggle-btn .comment-count');
    countSpan.textContent = Math.max(0, parseInt(countSpan.textContent) - 1);

    // Se não sobrou nenhum comentário meu neste post, volta o ícone pra "não comentou"
    const myRemaining = card.querySelectorAll('.comments-list .comment-delete-btn').length;
    if (myRemaining === 0) {
      const icon = card.querySelector('.comment-toggle-btn .comment-icon');
      if (icon) icon.src = COMMENT_EMPTY;
    }
  } catch (err) {
    console.error(err);
  }
}

async function submitComment(postId) {
  const box = document.querySelector(`.comments-box[data-post-id="${postId}"]`);
  const input = box.querySelector('.comment-input');
  const content = input.value.trim();

  if (!content) return;

  try {
    const response = await fetch(`${API_BASE}/api/feed/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content })
    });

    if (!response.ok) throw new Error('コメントの投稿に失敗しました');

    input.value = '';
    await loadComments(postId);

    const card = document.querySelector(`.post-card[data-post-id="${postId}"]`);
    const toggleBtn = card.querySelector('.comment-toggle-btn');
    const countSpan = toggleBtn.querySelector('.comment-count');
    countSpan.textContent = parseInt(countSpan.textContent) + 1;
    const icon = toggleBtn.querySelector('.comment-icon');
    if (icon) icon.src = COMMENT_DONE; // eu comentei -> ícone preenchido
  } catch (err) {
    console.error(err);
  }
}

postSubmitBtn.addEventListener('click', async () => {
  if (!token) {
    window.location.href = 'pages/login.html';
    return;
  }

  const content = postContentInput.value.trim();
  const mediaFile = postMediaInput.files[0];

  if (!content && !mediaFile) {
    postStatusMessage.textContent = '文章を書くかメディアを添付してください。';
    return;
  }

  postStatusMessage.textContent = '投稿中...';
  postSubmitBtn.disabled = true;

  const formData = new FormData();
  if (content) formData.append('content', content);
  if (mediaFile) formData.append('media', mediaFile);

  try {
    const response = await fetch(`${API_BASE}/api/feed/posts`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error || '投稿に失敗しました');

    postContentInput.value = '';
    postMediaInput.value = '';
    postMediaFilename.textContent = '';
    postStatusMessage.textContent = '';
    await loadFeed();
  } catch (err) {
    postStatusMessage.textContent = err.message;
  } finally {
    postSubmitBtn.disabled = false;
  }
});

loadFeed();
