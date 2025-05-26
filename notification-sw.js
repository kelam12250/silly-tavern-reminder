// SillyTavern 通知 ServiceWorker
// 专门用于解决Chrome 136移动端通知问题

console.log('SillyTavern 通知 ServiceWorker 已加载');

// 监听通知点击事件
self.addEventListener('notificationclick', function (event) {
  console.log('通知被点击:', event.notification);

  // 关闭通知
  event.notification.close();

  // 尝试聚焦到主窗口
  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then(function (clientList) {
        // 如果已经有窗口打开，聚焦到它
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes('sillytavern') && 'focus' in client) {
            return client.focus();
          }
        }

        // 如果没有窗口打开，打开一个新窗口
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      }),
  );
});

// 监听通知关闭事件
self.addEventListener('notificationclose', function (event) {
  console.log('通知被关闭:', event.notification);
});

// 监听消息事件（用于从主线程接收指令）
self.addEventListener('message', function (event) {
  console.log('ServiceWorker收到消息:', event.data);

  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;

    // 显示通知
    self.registration
      .showNotification(title, {
        body: options.body || '您有新的消息',
        icon: options.icon || '/favicon.ico',
        tag: options.tag || 'silly-tavern-sw',
        requireInteraction: false,
        silent: false,
        renotify: true,
        timestamp: Date.now(),
        ...options,
      })
      .then(() => {
        console.log('ServiceWorker通知显示成功');
      })
      .catch(error => {
        console.error('ServiceWorker通知显示失败:', error);
      });
  }
});

// 安装事件
self.addEventListener('install', function (event) {
  console.log('ServiceWorker 安装中...');
  // 立即激活新的ServiceWorker
  self.skipWaiting();
});

// 激活事件
self.addEventListener('activate', function (event) {
  console.log('ServiceWorker 已激活');
  // 立即控制所有客户端
  event.waitUntil(self.clients.claim());
});
