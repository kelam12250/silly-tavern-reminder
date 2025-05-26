// Chrome 136 移动端通知修复测试脚本
// 在浏览器控制台中运行此脚本来快速测试修复效果

console.log('=== Chrome 136 移动端通知修复测试 ===');

// 检测环境
const userAgent = navigator.userAgent;
const isChrome136 = userAgent.includes('Chrome/136');
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
const isHTTPS = location.protocol === 'https:';
const hasNotificationSupport = 'Notification' in window;
const hasServiceWorkerSupport = 'serviceWorker' in navigator;

console.log('环境检测:');
console.log('- Chrome 136:', isChrome136 ? '✅' : '❌');
console.log('- 移动设备:', isMobile ? '✅' : '❌');
console.log('- HTTPS环境:', isHTTPS ? '✅' : '❌');
console.log('- 通知支持:', hasNotificationSupport ? '✅' : '❌');
console.log('- ServiceWorker支持:', hasServiceWorkerSupport ? '✅' : '❌');

// 测试函数
async function testChrome136Fix() {
  if (!hasNotificationSupport) {
    console.error('❌ 浏览器不支持通知API');
    return false;
  }

  if (!hasServiceWorkerSupport) {
    console.error('❌ 浏览器不支持ServiceWorker');
    return false;
  }

  if (Notification.permission !== 'granted') {
    console.log('⚠️ 需要通知权限，正在申请...');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.error('❌ 通知权限被拒绝');
      return false;
    }
  }

  console.log('✅ 权限检查通过，开始测试...');

  try {
    // 首先尝试普通通知（应该在Chrome 136移动端失败）
    console.log('1. 测试普通通知...');
    try {
      const normalNotification = new Notification('普通通知测试', {
        body: '这是普通通知测试',
      });
      console.log('✅ 普通通知成功（非Chrome 136移动端）');
      normalNotification.close();
    } catch (normalError) {
      console.log('❌ 普通通知失败:', normalError.message);

      if (normalError.message.includes('Use ServiceWorkerRegistration.showNotification()')) {
        console.log('✅ 确认是Chrome 136移动端问题，需要使用ServiceWorker');
      }
    }

    // 测试ServiceWorker通知
    console.log('2. 测试ServiceWorker通知...');

    // 注册ServiceWorker
    const swCode = `
      self.addEventListener('notificationclick', function(event) {
        event.notification.close();
      });
      self.addEventListener('install', function(event) {
        self.skipWaiting();
      });
      self.addEventListener('activate', function(event) {
        event.waitUntil(self.clients.claim());
      });
    `;

    const blob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(blob);

    const registration = await navigator.serviceWorker.register(swUrl);
    console.log('✅ ServiceWorker注册成功');

    // 等待激活
    if (registration.installing) {
      await new Promise(resolve => {
        registration.installing.addEventListener('statechange', function () {
          if (this.state === 'activated') {
            resolve();
          }
        });
      });
    }

    // 发送ServiceWorker通知
    await registration.showNotification('ServiceWorker通知测试', {
      body: 'Chrome 136移动端修复成功！',
      icon: '/favicon.ico',
      tag: 'test-notification',
    });

    console.log('✅ ServiceWorker通知发送成功！');
    console.log('🎉 Chrome 136移动端通知修复验证成功！');

    return true;
  } catch (error) {
    console.error('❌ ServiceWorker通知测试失败:', error);
    return false;
  }
}

// 如果是Chrome 136移动端，自动运行测试
if (isChrome136 && isMobile) {
  console.log('🔧 检测到Chrome 136移动端，自动运行修复测试...');
  testChrome136Fix().then(success => {
    if (success) {
      console.log('🎉 修复测试成功！您的通知功能应该可以正常工作了。');
    } else {
      console.log('❌ 修复测试失败，请检查控制台错误信息。');
    }
  });
} else {
  console.log('ℹ️ 当前环境不是Chrome 136移动端，可以手动运行 testChrome136Fix() 来测试');
}

// 导出测试函数供手动调用
window.testChrome136Fix = testChrome136Fix;
