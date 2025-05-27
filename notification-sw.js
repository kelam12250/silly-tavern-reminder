// SillyTavern提醒扩展专用ServiceWorker
// 用于处理移动端通知兼容性问题

console.log('SillyTavern提醒扩展ServiceWorker已加载');

// 安装事件
self.addEventListener('install', function (event) {
  console.log('SillyTavern提醒ServiceWorker正在安装...');
  // 跳过等待，立即激活
  self.skipWaiting();
});

// 激活事件
self.addEventListener('activate', function (event) {
  console.log('SillyTavern提醒ServiceWorker已激活');
  // 立即控制所有客户端
  event.waitUntil(self.clients.claim());
});

// 通知点击事件处理
self.addEventListener('notificationclick', function (event) {
  console.log('ServiceWorker通知被点击:', event.notification.tag);

  // 关闭通知
  event.notification.close();

  // 尝试聚焦或打开窗口
  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then(function (clientList) {
        // 如果有打开的窗口，聚焦第一个
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if ('focus' in client) {
            console.log('聚焦现有窗口');
            return client.focus();
          }
        }

        // 如果没有打开的窗口，尝试打开新窗口
        if (clients.openWindow) {
          console.log('打开新窗口');
          return clients.openWindow('/');
        }
      })
      .catch(function (error) {
        console.error('处理通知点击事件时出错:', error);
      }),
  );
});

// 通知关闭事件处理
self.addEventListener('notificationclose', function (event) {
  console.log('ServiceWorker通知被关闭:', event.notification.tag);
});

// 消息事件处理（用于与主线程通信）
self.addEventListener('message', function (event) {
  console.log('ServiceWorker收到消息:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    // 跳过等待
    self.skipWaiting();
  }
});

// 错误处理
self.addEventListener('error', function (event) {
  console.error('ServiceWorker发生错误:', event.error);
});

console.log('SillyTavern提醒ServiceWorker事件监听器已设置完成');
