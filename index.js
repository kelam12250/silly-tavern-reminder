// 扩展的主脚本
// 以下是一些基本扩展功能的示例

// 你可能需要从 extensions.js 导入 extension_settings, getContext 和 loadExtensionSettings
import { extension_settings } from '../../../extensions.js';

// 你可能需要从主脚本导入一些其他函数
import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';

// 跟踪扩展的位置，名称应与仓库名称匹配
const extensionName = 'silly-tavern-reminder';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const defaultSettings = {
  enableReminder: true, // 添加提醒功能的默认值
  enableNotification: true, // 添加通知功能的默认值
  enableServiceWorkerNotification: false, // ServiceWorker通知的默认值（默认关闭）
  enableDebugMode: false, // 调试模式的默认值（默认关闭）
};

// 通知管理器
const NotificationManager = {
  // 检查是否为移动设备
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  // 检查通知支持
  checkSupport() {
    if (!('Notification' in window)) {
      console.log('此浏览器不支持通知功能');
      return false;
    }
    return true;
  },

  // 检查通知权限
  checkPermission() {
    return Notification.permission;
  },

  // 详细的环境检测
  getEnvironmentInfo() {
    const info = {
      isMobile: this.isMobile(),
      isHTTPS: location.protocol === 'https:',
      isLocalhost: location.hostname === 'localhost' || location.hostname === '카카오톡',
      userAgent: navigator.userAgent,
      notificationSupport: 'Notification' in window,
      permission: this.checkPermission(),
      serviceWorkerSupport: 'serviceWorker' in navigator,
    };

    console.log('环境信息:', info);
    return info;
  },

  // 请求通知权限
  async requestPermission() {
    if (!this.checkSupport()) return false;

    const envInfo = this.getEnvironmentInfo();

    // 移动端特殊处理
    if (envInfo.isMobile) {
      console.log('检测到移动设备，正在尝试请求通知权限...');

      // 检查是否为HTTPS或localhost
      if (!envInfo.isHTTPS && !envInfo.isLocalhost) {
        console.error('移动端需要HTTPS环境才能使用通知功能');
        toastr.error('移动端需要HTTPS环境才能使用通知功能');
        return false;
      }
    }

    try {
      // 使用Promise版本，如果不支持则回退到回调版本
      let permission;
      if (typeof Notification.requestPermission === 'function') {
        if (Notification.requestPermission.length === 0) {
          // Promise版本
          permission = await Notification.requestPermission();
        } else {
          // 回调版本
          permission = await new Promise(resolve => {
            Notification.requestPermission(resolve);
          });
        }
      }

      console.log('权限请求结果:', permission);

      if (permission === 'granted') {
        // 发送测试通知
        this.sendTestNotification();
      }

      return permission === 'granted';
    } catch (error) {
      console.error('请求通知权限时出错:', error);

      // 移动端特殊错误处理
      if (envInfo.isMobile) {
        toastr.error('移动端通知权限请求失败，请检查浏览器设置');
      }

      return false;
    }
  },

  // 发送测试通知
  sendTestNotification() {
    try {
      const testNotification = new Notification('通知权限测试', {
        body: '如果您看到这条通知，说明权限已经设置成功',
        icon: '/favicon.ico',
        tag: 'permission-test',
        requireInteraction: false, // 移动端可能需要设置为false
      });

      // 移动端可能需要更短的显示时间
      if (this.isMobile()) {
        setTimeout(() => {
          testNotification.close();
        }, 3000);
      }

      testNotification.onclick = function () {
        console.log('测试通知被点击');
        this.close();
      };
    } catch (error) {
      console.error('发送测试通知失败:', error);
    }
  },

  // 发送通知
  async send(title = 'P.G', body = '읽지 않은 새 메시지 1개', options = {}) {
    try {
      const permission = this.checkPermission();
      const envInfo = this.getEnvironmentInfo();

      console.log('尝试发送通知:', { title, body, permission, envInfo });

      if (permission !== 'granted') {
        console.log('没有通知权限，权限状态:', permission);
        return null;
      }

      if (!extension_settings[extensionName].enableNotification) {
        console.log('通知功能已被用户禁用');
        return null;
      }

      // 检查是否需要使用ServiceWorker通知（用户设置或Chrome 136移动端）
      const shouldUseServiceWorker =
        extension_settings[extensionName].enableServiceWorkerNotification || this.needsServiceWorkerNotification();

      if (shouldUseServiceWorker) {
        console.log('使用ServiceWorker通知（用户设置或Chrome 136移动端）...');
        try {
          await this.sendViaServiceWorker(title, body, options);
          return { type: 'serviceWorker', success: true };
        } catch (swError) {
          console.error('ServiceWorker通知失败:', swError);

          // 如果用户明确启用了ServiceWorker模式，失败时不降级
          if (extension_settings[extensionName].enableServiceWorkerNotification) {
            console.log('用户启用了ServiceWorker模式，不降级到普通通知');
            throw new Error('ServiceWorker通知失败: ' + swError.message);
          }

          // 否则尝试降级到普通通知
          console.error('ServiceWorker通知失败，尝试降级到普通通知:', swError);
        }
      }

      // 移动端优化的通知选项
      const notificationOptions = {
        body: body,
        icon: '/favicon.ico',
        tag: 'silly-tavern-message',
        requireInteraction: false, // 移动端必须设为false
        silent: false,
        renotify: true, // 允许重复通知
        ...options,
      };

      // 移动端特殊处理
      if (envInfo.isMobile) {
        // 移除移动端不支持或可能导致问题的选项
        delete notificationOptions.vibrate;
        delete notificationOptions.actions;
        delete notificationOptions.image;
        delete notificationOptions.badge;

        // 移动端使用更简单的配置
        notificationOptions.requireInteraction = false;
        notificationOptions.silent = false;

        // Android Chrome特殊处理
        if (envInfo.userAgent.includes('Android') && envInfo.userAgent.includes('Chrome')) {
          // 确保tag是唯一的，避免被覆盖
          notificationOptions.tag = `silly-tavern-${Date.now()}`;
          // 添加时间戳确保通知能显示
          notificationOptions.timestamp = Date.now();
        }
      }

      console.log('最终通知选项:', notificationOptions);

      // 尝试创建通知
      let notification;
      try {
        notification = new Notification(title, notificationOptions);
        console.log('通知对象创建成功:', notification);
      } catch (createError) {
        console.error('创建通知对象失败:', createError);

        // 如果是Chrome 136的构造函数错误，提示使用ServiceWorker
        if (createError.message.includes('Use ServiceWorkerRegistration.showNotification()')) {
          console.log('检测到需要使用ServiceWorker通知，重新尝试...');
          try {
            await this.sendViaServiceWorker(title, body, options);
            return { type: 'serviceWorker', success: true };
          } catch (swError) {
            console.error('ServiceWorker通知也失败:', swError);
            throw new Error('Chrome 136移动端通知功能受限，ServiceWorker通知也失败');
          }
        }

        // 尝试使用最简配置重新创建
        if (envInfo.isMobile) {
          console.log('尝试使用最简配置重新创建通知...');
          const simpleOptions = {
            body: body,
            tag: `simple-${Date.now()}`,
          };

          try {
            notification = new Notification(title, simpleOptions);
            console.log('使用简单配置创建通知成功');
          } catch (simpleError) {
            console.error('简单配置也失败:', simpleError);
            throw simpleError;
          }
        } else {
          throw createError;
        }
      }

      // 设置事件监听器
      notification.onclick = function () {
        console.log('通知被点击');
        try {
          window.focus();
          if (parent && parent !== window) {
            parent.focus();
          }
        } catch (focusError) {
          console.warn('聚焦窗口失败:', focusError);
        }
        this.close();
      };

      notification.onerror = function (error) {
        console.error('通知显示错误:', error);
      };

      notification.onshow = function () {
        console.log('通知已显示');
      };

      notification.onclose = function () {
        console.log('通知已关闭');
      };

      // 移动端自动关闭（避免通知堆积）
      if (envInfo.isMobile) {
        setTimeout(() => {
          try {
            if (notification) {
              notification.close();
              console.log('移动端通知自动关闭');
            }
          } catch (closeError) {
            console.warn('关闭通知失败:', closeError);
          }
        }, 8000); // 8秒后自动关闭
      }

      return notification;
    } catch (error) {
      console.error('发送通知时出错:', error);
      console.error('错误详情:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      // 移动端特殊错误处理和建议
      if (this.isMobile()) {
        console.error('移动端通知错误分析:');
        console.error('1. 错误类型:', error.name);
        console.error('2. 错误信息:', error.message);

        // 根据错误类型提供具体建议
        if (error.name === 'TypeError') {
          console.error('建议: 可能是通知选项不兼容，尝试使用更简单的配置');
        } else if (error.name === 'NotAllowedError') {
          console.error('建议: 权限问题，检查浏览器和系统通知设置');
        } else if (error.name === 'AbortError') {
          console.error('建议: 通知被中止，可能是系统限制');
        } else if (error.message.includes('ServiceWorkerRegistration.showNotification()')) {
          console.error('建议: Chrome 136移动端需要使用ServiceWorker通知');
        }

        // 提供用户友好的错误提示
        if (window.toastr) {
          toastr.error(`移动端通知发送失败: ${error.message}`);
        }
      }

      return null;
    }
  },

  // 智能推荐ServiceWorker模式
  checkAndRecommendServiceWorker() {
    if (this.shouldRecommendServiceWorker()) {
      const envInfo = this.getEnvironmentInfo();
      console.log('检测到可能需要ServiceWorker通知的环境');

      // 延迟显示推荐，避免干扰用户
      setTimeout(() => {
        if (window.toastr) {
          toastr.info(
            '检测到您使用的浏览器可能存在通知兼容性问题\n' +
              '建议在设置中启用"ServiceWorker通知"选项以获得更好的通知体验',
            '通知优化建议',
            { timeOut: 8000 },
          );
        }
      }, 3000);
    }
  },

  // 发送错误通知
  sendError(error) {
    const errorMessage = error?.message || '未知错误';
    this.send('SillyTavern 发生错误', `错误信息: ${errorMessage}`);
  },

  // 检查是否需要使用ServiceWorker通知
  needsServiceWorkerNotification() {
    const envInfo = this.getEnvironmentInfo();

    // Chrome 136移动端的特殊兼容性问题
    if (envInfo.isMobile && envInfo.userAgent.includes('Chrome/136')) {
      return true;
    }

    // 其他已知的移动端问题情况
    // 可以根据实际使用反馈添加更多条件
    return false;
  },

  // 检查是否应该推荐使用ServiceWorker模式
  shouldRecommendServiceWorker() {
    const envInfo = this.getEnvironmentInfo();

    // 如果用户已经启用，不再推荐
    if (extension_settings[extensionName].enableServiceWorkerNotification) {
      return false;
    }

    // 移动端Chrome 136已知问题
    if (envInfo.isMobile && envInfo.userAgent.includes('Chrome/136')) {
      return true;
    }

    // 其他可能的推荐情况
    return false;
  },

  // 使用ServiceWorker发送通知
  async sendViaServiceWorker(title, body, options = {}) {
    try {
      console.log('使用ServiceWorker发送通知...');

      if (!('serviceWorker' in navigator)) {
        throw new Error('ServiceWorker不支持');
      }

      // 注册ServiceWorker（如果还没有）
      let registration = await navigator.serviceWorker.getRegistration();

      if (!registration) {
        console.log('注册专门的通知ServiceWorker...');

        // 使用专门的ServiceWorker文件
        const swPath = `/scripts/extensions/third-party/${extensionName}/notification-sw.js`;

        try {
          registration = await navigator.serviceWorker.register(swPath);
          console.log('专门的ServiceWorker注册成功:', registration);
        } catch (registerError) {
          console.log('专门的ServiceWorker注册失败，使用内联版本:', registerError);

          // 如果专门文件失败，使用内联ServiceWorker
          const swCode = `
            console.log('内联ServiceWorker已加载');
            
            self.addEventListener('notificationclick', function(event) {
              console.log('通知被点击');
              event.notification.close();
              event.waitUntil(
                clients.matchAll({ type: 'window' }).then(function(clientList) {
                  for (let i = 0; i < clientList.length; i++) {
                    const client = clientList[i];
                    if ('focus' in client) {
                      return client.focus();
                    }
                  }
                  if (clients.openWindow) {
                    return clients.openWindow('/');
                  }
                })
              );
            });
            
            self.addEventListener('install', function(event) {
              console.log('内联ServiceWorker安装');
              self.skipWaiting();
            });
            
            self.addEventListener('activate', function(event) {
              console.log('内联ServiceWorker激活');
              event.waitUntil(self.clients.claim());
            });
          `;

          const blob = new Blob([swCode], { type: 'application/javascript' });
          const swUrl = URL.createObjectURL(blob);

          registration = await navigator.serviceWorker.register(swUrl);
          console.log('内联ServiceWorker注册成功:', registration);
        }
      }

      // 等待ServiceWorker激活
      if (registration.installing) {
        console.log('等待ServiceWorker安装...');
        await new Promise(resolve => {
          registration.installing.addEventListener('statechange', function () {
            if (this.state === 'activated') {
              console.log('ServiceWorker已激活');
              resolve();
            }
          });
        });
      } else if (registration.waiting) {
        console.log('ServiceWorker等待激活...');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        await new Promise(resolve => {
          navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
        });
      }

      // 使用ServiceWorker发送通知
      const notificationOptions = {
        body: body,
        icon: '/favicon.ico',
        tag: `sw-notification-${Date.now()}`,
        requireInteraction: false,
        silent: false,
        renotify: true,
        timestamp: Date.now(),
        ...options,
      };

      console.log('通过ServiceWorker显示通知:', { title, notificationOptions });

      await registration.showNotification(title, notificationOptions);
      console.log('ServiceWorker通知发送成功');

      return true;
    } catch (error) {
      console.error('ServiceWorker通知发送失败:', error);
      throw error;
    }
  },
};

// 标题闪烁管理器
const TitleFlashManager = {
  timer: null,
  originalTitle: '',
  isFlashing: false,
  newMessageTitle: '【收到新消息了】',
  flashInterval: 1000,

  start() {
    if (this.isFlashing) return;
    this.isFlashing = true;
    this.originalTitle = document.title;
    this.timer = setInterval(() => {
      document.title = document.title === this.newMessageTitle ? this.originalTitle : this.newMessageTitle;
    }, this.flashInterval);
  },

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isFlashing = false;
    document.title = this.originalTitle;
  },
};

// 使用事件委托优化事件监听
const handleVisibilityChange = () => {
  if (!document.hidden && TitleFlashManager.isFlashing) {
    TitleFlashManager.stop();
  }
};

const handleWindowFocus = () => {
  if (TitleFlashManager.isFlashing) {
    TitleFlashManager.stop();
  }
};

// 添加事件监听
document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('focus', handleWindowFocus);

// 设置管理器
const SettingsManager = {
  // 加载设置
  async load() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
      Object.assign(extension_settings[extensionName], defaultSettings);
    }
    this.updateUI();
  },

  // 更新UI
  updateUI() {
    $('#title_reminder_setting').prop('checked', extension_settings[extensionName].enableReminder);
    $('#notification_setting').prop('checked', extension_settings[extensionName].enableNotification);
    $('#serviceworker_notification_setting').prop(
      'checked',
      extension_settings[extensionName].enableServiceWorkerNotification,
    );
    $('#debug_mode_setting').prop('checked', extension_settings[extensionName].enableDebugMode);

    // 根据调试模式设置显示调试区域
    this.updateDebugSection();
  },

  // 更新调试区域显示
  updateDebugSection() {
    if (extension_settings[extensionName].enableDebugMode) {
      $('#debug_info_section').show();
    } else {
      $('#debug_info_section').hide();
      $('#debug_output').hide(); // 隐藏调试输出
    }
  },

  // 保存设置
  save(key, value) {
    extension_settings[extensionName][key] = value;
    saveSettingsDebounced();
  },
};

// 事件处理器
const EventHandler = {
  // 处理提醒开关
  async onReminderToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    SettingsManager.save('enableReminder', value);
  },

  // 处理通知开关
  async onNotificationToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    const permission = NotificationManager.checkPermission();
    const envInfo = NotificationManager.getEnvironmentInfo();

    console.log('通知开关切换:', { value, permission, envInfo });

    if (value && permission === 'denied') {
      toastr.error('通知权限已被拒绝，请在浏览器设置中手动开启');
      $(event.target).prop('checked', false);
      return;
    }

    // 移动端特殊提示
    if (value && envInfo.isMobile && !envInfo.isHTTPS && !envInfo.isLocalhost) {
      toastr.error('移动端需要HTTPS环境才能使用通知功能');
      $(event.target).prop('checked', false);
      return;
    }

    if (value && permission !== 'granted' && event.isTrigger === undefined) {
      const granted = await NotificationManager.requestPermission();
      if (!granted) {
        $(event.target).prop('checked', false);

        // 移动端特殊提示
        if (envInfo.isMobile) {
          toastr.warning('移动端通知权限获取失败，请检查浏览器设置或尝试使用支持通知的浏览器');
        }
        return;
      }
    }

    SettingsManager.save('enableNotification', value);
  },

  // 处理ServiceWorker通知开关
  async onServiceWorkerNotificationToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    const envInfo = NotificationManager.getEnvironmentInfo();

    console.log('ServiceWorker通知开关切换:', { value, envInfo });

    // 如果启用ServiceWorker通知，先检查环境
    if (value) {
      if (!('serviceWorker' in navigator)) {
        toastr.error('当前浏览器不支持ServiceWorker功能');
        $(event.target).prop('checked', false);
        return;
      }

      // 检查通知权限
      const permission = NotificationManager.checkPermission();
      if (permission !== 'granted') {
        toastr.warning('请先申请通知权限才能使用ServiceWorker通知');
        $(event.target).prop('checked', false);
        return;
      }

      // 移动端提示
      if (envInfo.isMobile) {
        toastr.info('已启用ServiceWorker通知模式，适用于解决移动端通知兼容性问题');
      } else {
        toastr.info('已启用ServiceWorker通知模式，通常移动端默认通知失效时使用');
      }
    } else {
      toastr.info('已关闭ServiceWorker通知，将使用默认通知方式');
    }

    SettingsManager.save('enableServiceWorkerNotification', value);
  },

  // 处理调试模式开关
  async onDebugModeToggle(event) {
    const value = Boolean($(event.target).prop('checked'));

    console.log('调试模式开关切换:', value);

    if (value) {
      toastr.info('已启用调试模式，显示调试工具和环境信息');
    } else {
      toastr.info('已关闭调试模式，隐藏调试工具');
    }

    SettingsManager.save('enableDebugMode', value);
    SettingsManager.updateDebugSection();
  },

  // 处理权限申请
  async onRequestPermissionClick() {
    const envInfo = NotificationManager.getEnvironmentInfo();

    console.log('手动申请通知权限:', envInfo);

    if (!NotificationManager.checkSupport()) {
      toastr.error('此浏览器不支持通知功能');
      return;
    }

    // 移动端特殊检查
    if (envInfo.isMobile) {
      if (!envInfo.isHTTPS && !envInfo.isLocalhost) {
        toastr.error('移动端需要HTTPS环境才能使用通知功能');
        return;
      }

      // 移动端浏览器特殊提示
      if (envInfo.userAgent.includes('iPhone') || envInfo.userAgent.includes('iPad')) {
        toastr.info('iOS设备可能需要iOS 16.4+版本才支持Web通知');
      }
    }

    const permission = NotificationManager.checkPermission();
    if (permission === 'denied') {
      toastr.error('通知权限已被拒绝，请在浏览器设置中手动开启');

      // 提供移动端设置指导
      if (envInfo.isMobile) {
        toastr.info('移动端请在浏览器设置 -> 网站设置 -> 通知 中开启权限');
      }
      return;
    }

    const granted = await NotificationManager.requestPermission();
    if (granted) {
      toastr.success('已获得通知权限');
    } else {
      if (envInfo.isMobile) {
        toastr.warning('移动端通知权限获取失败，可能原因：\n1. 浏览器不支持\n2. 系统版本过低\n3. 浏览器设置限制');
      } else {
        toastr.warning('未获得通知权限，系统通知功能将无法使用');
      }
    }
  },
};

// 消息处理器
const MessageHandler = {
  shouldSendReminder() {
    const hidden = document.hidden;
    const focused = document.hasFocus();
    const envInfo = NotificationManager.getEnvironmentInfo();

    console.log('检查是否需要发送提醒:', {
      hidden,
      focused,
      isMobile: envInfo.isMobile,
      shouldSend: hidden || (!hidden && !focused),
    });

    return hidden || (!hidden && !focused);
  },

  async handleIncomingMessage(data) {
    const needReminder = this.shouldSendReminder();
    const envInfo = NotificationManager.getEnvironmentInfo();

    console.log('处理新消息:', {
      needReminder,
      envInfo,
      enableReminder: extension_settings[extensionName].enableReminder,
      enableNotification: extension_settings[extensionName].enableNotification,
    });

    if (needReminder) {
      // 标题闪烁提醒
      if (extension_settings[extensionName].enableReminder) {
        console.log('启动标题闪烁提醒');
        TitleFlashManager.start();
      }

      // 系统通知
      if (extension_settings[extensionName].enableNotification) {
        console.log('尝试发送系统通知');
        const notification = await NotificationManager.send();

        if (!notification && envInfo.isMobile) {
          console.log('移动端通知发送失败，可能需要检查环境和权限');
        }
      }
    } else {
      console.log('当前页面处于活跃状态，不需要发送提醒');
    }
  },
};

// 监听消息生成完毕事件
eventSource.on(event_types.MESSAGE_RECEIVED, MessageHandler.handleIncomingMessage.bind(MessageHandler));

// 错误处理器
const ErrorHandler = {
  init() {
    // 捕获未处理的Promise错误
    window.addEventListener('unhandledrejection', event => {
      const errorMessage = String(event.reason);
      if (errorMessage.includes('Uncaught (in promise) Error:')) {
        NotificationManager.sendError(event.reason);
      }
    });

    // 捕获全局运行时错误
    window.addEventListener('error', event => {
      const errorMessage = String(event.error);
      if (errorMessage.includes('Uncaught (in promise) Error:')) {
        NotificationManager.sendError(event.error);
      }
    });
  },
};

// 移动端通知检查工具
const MobileNotificationChecker = {
  // 全面检查移动端通知环境
  async checkMobileNotificationEnvironment() {
    const results = {
      basicSupport: false,
      permission: 'unknown',
      httpsCheck: false,
      userAgentInfo: '',
      systemChecks: [],
      recommendations: [],
    };

    console.log('=== 移动端通知环境检查 ===');

    // 1. 基础支持检查
    results.basicSupport = 'Notification' in window;
    console.log('1. 基础API支持:', results.basicSupport ? '✅' : '❌');

    // 2. 权限检查
    if (results.basicSupport) {
      results.permission = Notification.permission;
      console.log('2. 权限状态:', results.permission);
    }

    // 3. HTTPS检查
    results.httpsCheck = location.protocol === 'https:' || location.hostname === 'localhost';
    console.log('3. HTTPS环境:', results.httpsCheck ? '✅' : '❌');

    // 4. 用户代理检查
    results.userAgentInfo = navigator.userAgent;
    console.log('4. 用户代理:', results.userAgentInfo);

    // 5. 移动端特殊检查
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      console.log('5. 移动设备检测: ✅');

      // Android检查
      if (results.userAgentInfo.includes('Android')) {
        const androidVersion = results.userAgentInfo.match(/Android (\d+)/);
        if (androidVersion) {
          const version = parseInt(androidVersion[1]);
          results.systemChecks.push({
            name: 'Android版本',
            status: version >= 7 ? '✅' : '⚠️',
            detail: `Android ${version} ${version >= 7 ? '(支持)' : '(可能不支持)'}`,
          });
        }

        if (results.userAgentInfo.includes('Chrome')) {
          const chromeVersion = results.userAgentInfo.match(/Chrome\/(\d+)/);
          if (chromeVersion) {
            const version = parseInt(chromeVersion[1]);
            results.systemChecks.push({
              name: 'Chrome版本',
              status: version >= 59 ? '✅' : '⚠️',
              detail: `Chrome ${version} ${version >= 59 ? '(支持)' : '(版本过低)'}`,
            });
          }
        }
      }

      // iOS检查
      if (results.userAgentInfo.includes('iPhone') || results.userAgentInfo.includes('iPad')) {
        const iosVersion = results.userAgentInfo.match(/OS (\d+)_(\d+)/);
        if (iosVersion) {
          const majorVersion = parseInt(iosVersion[1]);
          const minorVersion = parseInt(iosVersion[2]);
          const isSupported = majorVersion > 16 || (majorVersion === 16 && minorVersion >= 4);

          results.systemChecks.push({
            name: 'iOS版本',
            status: isSupported ? '✅' : '❌',
            detail: `iOS ${majorVersion}.${minorVersion} ${isSupported ? '(支持)' : '(需要16.4+)'}`,
          });
        }
      }
    }

    // 6. 生成建议
    if (!results.basicSupport) {
      results.recommendations.push('浏览器不支持Web Notification API，请更换现代浏览器');
    }

    if (!results.httpsCheck) {
      results.recommendations.push('需要HTTPS环境，请使用HTTPS访问网站');
    }

    if (results.permission === 'denied') {
      results.recommendations.push('通知权限被拒绝，请在浏览器设置中手动开启');
    }

    if (results.permission === 'default') {
      results.recommendations.push('尚未申请通知权限，请点击"申请通知权限"按钮');
    }

    // 移动端特殊建议
    if (isMobile) {
      results.recommendations.push('移动端建议：检查系统设置→通知→浏览器应用');
      results.recommendations.push('移动端建议：确保浏览器有后台运行权限');
      results.recommendations.push('移动端建议：关闭电池优化中的浏览器限制');
    }

    return results;
  },

  // 显示检查结果
  displayCheckResults(results) {
    console.log('=== 检查结果汇总 ===');
    console.log('基础支持:', results.basicSupport ? '✅' : '❌');
    console.log('HTTPS环境:', results.httpsCheck ? '✅' : '❌');
    console.log('权限状态:', results.permission);

    if (results.systemChecks.length > 0) {
      console.log('系统检查:');
      results.systemChecks.forEach(check => {
        console.log(`- ${check.name}: ${check.status} ${check.detail}`);
      });
    }

    if (results.recommendations.length > 0) {
      console.log('建议:');
      results.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    // 显示给用户
    const summary = `
通知环境检查结果：
• 基础支持: ${results.basicSupport ? '✅' : '❌'}
• HTTPS环境: ${results.httpsCheck ? '✅' : '❌'}  
• 权限状态: ${results.permission}
${results.systemChecks.map(c => `• ${c.name}: ${c.status} ${c.detail}`).join('\n')}

${
  results.recommendations.length > 0
    ? '建议：\n' + results.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')
    : ''
}
    `.trim();

    toastr.info(summary);
  },
};

// Chrome 136 移动端通知问题检测器
const Chrome136NotificationFixer = {
  // 检测是否为Chrome 136
  isChrome136() {
    const userAgent = navigator.userAgent;
    const chromeMatch = userAgent.match(/Chrome\/(\d+)/);
    return chromeMatch && parseInt(chromeMatch[1]) === 136;
  },

  // Chrome 136 特殊处理
  async fixChrome136Notification() {
    if (!this.isChrome136()) {
      return false;
    }

    console.log('检测到Chrome 136，应用ServiceWorker通知修复...');

    try {
      // Chrome 136 移动端优先使用ServiceWorker通知
      if (NotificationManager.isMobile()) {
        console.log('Chrome 136移动端，使用ServiceWorker通知...');
        await NotificationManager.sendViaServiceWorker(
          'Chrome 136 修复成功',
          '已成功使用ServiceWorker发送通知，这应该解决了Chrome 136移动端的通知问题',
        );
        return true;
      }

      // 桌面端仍然尝试普通通知
      const notification = new Notification('Chrome 136 修复测试', {
        body: '正在测试Chrome 136的通知修复',
        requireInteraction: false,
        silent: false,
        renotify: false,
      });

      // Chrome 136 特殊事件处理
      notification.onshow = function () {
        console.log('Chrome 136 通知修复成功！');
        toastr.success('Chrome 136 通知修复成功！');
      };

      notification.onerror = function (error) {
        console.error('Chrome 136 通知修复失败:', error);
        // 尝试更简单的配置
        Chrome136NotificationFixer.tryMinimalNotification();
      };

      notification.onclick = function () {
        this.close();
      };

      // Chrome 136 移动端自动关闭
      setTimeout(() => {
        try {
          notification.close();
        } catch (e) {
          console.warn('关闭Chrome 136通知失败:', e);
        }
      }, 6000);

      return true;
    } catch (error) {
      console.error('Chrome 136 修复失败:', error);

      // 如果是ServiceWorker错误，尝试最小化通知
      if (error.message.includes('Use ServiceWorkerRegistration.showNotification()')) {
        console.log('检测到需要ServiceWorker，重新尝试...');
        try {
          await NotificationManager.sendViaServiceWorker(
            'Chrome 136 ServiceWorker修复',
            '使用ServiceWorker成功解决Chrome 136移动端通知问题',
          );
          return true;
        } catch (swError) {
          console.error('ServiceWorker修复也失败:', swError);
          return false;
        }
      }

      return this.tryMinimalNotification();
    }
  },

  // 尝试最小化配置
  async tryMinimalNotification() {
    try {
      console.log('尝试Chrome 136最小化通知配置...');

      // 最简配置，只有标题和内容
      const notification = new Notification('最简测试');

      notification.onshow = function () {
        console.log('Chrome 136最简通知成功！');
        toastr.success('Chrome 136最简通知成功！');
      };

      notification.onerror = function (error) {
        console.error('Chrome 136最简通知也失败:', error);
        toastr.error('Chrome 136通知功能可能存在兼容性问题');
      };

      setTimeout(() => {
        try {
          notification.close();
        } catch (e) {
          console.warn('关闭最简通知失败:', e);
        }
      }, 4000);

      return true;
    } catch (error) {
      console.error('Chrome 136最简通知失败:', error);

      // 提供Chrome 136特殊建议
      toastr.error(
        'Chrome 136移动端通知问题\n建议：\n1. 重启Chrome浏览器\n2. 清除浏览器缓存\n3. 检查系统通知设置\n4. 尝试使用其他浏览器',
      );

      return false;
    }
  },

  // Chrome 136 环境检查
  checkChrome136Environment() {
    const envInfo = NotificationManager.getEnvironmentInfo();

    console.log('=== Chrome 136 环境检查 ===');
    console.log('Chrome版本:', envInfo.userAgent.match(/Chrome\/(\d+)/)?.[1] || '未知');
    console.log('是否为Chrome 136:', this.isChrome136());
    console.log('移动设备:', envInfo.isMobile);
    console.log('HTTPS环境:', envInfo.isHTTPS);
    console.log('通知支持:', envInfo.notificationSupport);
    console.log('权限状态:', envInfo.permission);

    if (this.isChrome136() && envInfo.isMobile) {
      console.log('Chrome 136移动端特殊提示:');
      console.log('1. Chrome 136是2025年4月发布的新版本');
      console.log('2. 可能存在移动端通知的兼容性问题');
      console.log('3. 建议尝试重启浏览器或清除缓存');
      console.log('4. 如果问题持续，可能需要等待Chrome更新修复');
    }

    return {
      isChrome136: this.isChrome136(),
      needsSpecialHandling: this.isChrome136() && envInfo.isMobile,
    };
  },
};

// 初始化管理器
const InitManager = {
  async init() {
    try {
      // 初始化错误处理器
      ErrorHandler.init();

      // 加载HTML和CSS
      const settingsHtml = await $.get(`${extensionFolderPath}/reminder.html`);
      $('#extensions_settings2').append(settingsHtml);

      const styleSheet = document.createElement('link');
      styleSheet.rel = 'stylesheet';
      styleSheet.href = `/scripts/extensions/third-party/${extensionName}/style.css`;
      document.head.appendChild(styleSheet);

      // 检测移动端并显示相应提示
      this.setupMobileDetection();

      // 绑定事件监听
      this.bindEventListeners();

      // 加载设置
      await SettingsManager.load();

      // 检查通知权限
      const permission = NotificationManager.checkPermission();
      if (permission === 'granted') {
        console.log('已具有通知权限');
      } else {
        console.log('当前通知权限状态:', permission);
      }

      // 显示环境信息
      const envInfo = NotificationManager.getEnvironmentInfo();
      console.log('扩展初始化完成，环境信息:', envInfo);

      // 检查并推荐ServiceWorker模式（如果需要）
      NotificationManager.checkAndRecommendServiceWorker();
    } catch (error) {
      console.error('初始化扩展时出错:', error);
    }
  },

  setupMobileDetection() {
    const envInfo = NotificationManager.getEnvironmentInfo();

    // 如果是移动设备，显示兼容性警告
    if (envInfo.isMobile) {
      $('#mobile_compatibility_warning').show();

      // 如果不是HTTPS环境，额外提示
      if (!envInfo.isHTTPS && !envInfo.isLocalhost) {
        const warningDiv = $('#mobile_compatibility_warning div');
        warningDiv.append('<li style="color: #dc3545; font-weight: bold;">当前非HTTPS环境，通知功能将无法使用</li>');
      }

      // Chrome 136 特殊检查
      const chrome136Check = Chrome136NotificationFixer.checkChrome136Environment();
      if (chrome136Check.isChrome136) {
        const warningDiv = $('#mobile_compatibility_warning div ul');
        warningDiv.append(
          '<li style="color: #ff6b35; font-weight: bold;">检测到Chrome 136移动端，可能存在通知兼容性问题</li>',
        );
        warningDiv.append('<li style="color: #ff6b35;">建议：重启浏览器、清除缓存或尝试Chrome 136修复功能</li>');
      }
    }

    // 注意：调试信息现在通过用户设置控制，而不是自动显示
  },

  bindEventListeners() {
    // 原有的事件监听
    $('#title_reminder_setting').on('input', EventHandler.onReminderToggle);
    $('#notification_setting').on('input', EventHandler.onNotificationToggle);
    $('#serviceworker_notification_setting').on('input', EventHandler.onServiceWorkerNotificationToggle);
    $('#debug_mode_setting').on('input', EventHandler.onDebugModeToggle);
    $('#request_notification_permission').on('click', EventHandler.onRequestPermissionClick);

    // 新增的调试功能事件监听
    $('#show_debug_info').on('click', this.showDebugInfo);
    $('#test_notification').on('click', this.testNotification);
    $('#test_simple_notification').on('click', this.testSimpleNotification);
    $('#check_mobile_environment').on('click', this.checkMobileEnvironment);
    $('#test_chrome136_fix').on('click', this.testChrome136Fix);
    $('#test_serviceworker_notification').on('click', this.testServiceWorkerNotification);
  },

  showDebugInfo() {
    const envInfo = NotificationManager.getEnvironmentInfo();
    const debugOutput = $('#debug_output');

    const debugInfo = {
      环境信息: envInfo,
      扩展设置: extension_settings[extensionName],
      ServiceWorker设置: {
        启用状态: extension_settings[extensionName].enableServiceWorkerNotification,
        自动检测需要SW: NotificationManager.needsServiceWorkerNotification(),
        浏览器SW支持: 'serviceWorker' in navigator,
      },
      调试模式设置: {
        启用状态: extension_settings[extensionName].enableDebugMode,
        调试区域显示: $('#debug_info_section').is(':visible'),
      },
      浏览器信息: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
      },
      页面信息: {
        protocol: location.protocol,
        hostname: location.hostname,
        port: location.port,
        pathname: location.pathname,
        hidden: document.hidden,
        hasFocus: document.hasFocus(),
        visibilityState: document.visibilityState,
      },
    };

    debugOutput.html(`<pre>${JSON.stringify(debugInfo, null, 2)}</pre>`);
    debugOutput.show();

    console.log('调试信息:', debugInfo);
  },

  async testNotification() {
    const envInfo = NotificationManager.getEnvironmentInfo();
    console.log('手动测试通知:', envInfo);

    if (!NotificationManager.checkSupport()) {
      toastr.error('此浏览器不支持通知功能');
      return;
    }

    const permission = NotificationManager.checkPermission();
    if (permission !== 'granted') {
      toastr.warning('请先申请通知权限');
      return;
    }

    // 移动端特殊检查
    if (envInfo.isMobile) {
      console.log('移动端测试通知 - 环境检查:');
      console.log('- 设备类型:', envInfo.isMobile ? '移动设备' : '桌面设备');
      console.log('- HTTPS状态:', envInfo.isHTTPS ? '是' : '否');
      console.log('- 通知支持:', envInfo.notificationSupport ? '是' : '否');
      console.log('- 权限状态:', envInfo.permission);
      console.log('- Service Worker支持:', envInfo.serviceWorkerSupport ? '是' : '否');

      // 检查可能的移动端限制
      if (envInfo.userAgent.includes('Android')) {
        console.log('- Android设备检测到');
        if (envInfo.userAgent.includes('Chrome')) {
          console.log('- 使用Chrome浏览器，兼容性良好');
        }
      }

      if (envInfo.userAgent.includes('iPhone') || envInfo.userAgent.includes('iPad')) {
        console.log('- iOS设备检测到');
        const iosVersion = envInfo.userAgent.match(/OS (\d+)_/);
        if (iosVersion && parseInt(iosVersion[1]) < 16) {
          console.warn('- iOS版本可能过低，建议升级到16.4+');
          toastr.warning('iOS版本可能过低，建议升级到16.4+');
        }
      }
    }

    try {
      console.log('开始发送测试通知...');

      // 先尝试发送一个最简单的通知
      const simpleNotification = await NotificationManager.send(
        '🔔 测试通知',
        '这是一条测试通知，用于验证通知功能是否正常工作',
      );

      if (simpleNotification) {
        console.log('测试通知发送成功:', simpleNotification);
        toastr.success('测试通知已发送！如果您没有看到通知，请检查系统通知设置');

        // 移动端额外提示
        if (envInfo.isMobile) {
          setTimeout(() => {
            toastr.info('移动端提示：如果没有看到通知，请检查：\n1. 系统设置→通知→浏览器\n2. 浏览器设置→网站设置→通知');
          }, 2000);
        }
      } else {
        console.error('测试通知发送失败 - 返回null');
        toastr.error('测试通知发送失败');

        // 移动端故障排除建议
        if (envInfo.isMobile) {
          this.showMobileTroubleshooting();
        }
      }
    } catch (error) {
      console.error('测试通知失败:', error);
      console.error('错误详情:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      toastr.error('测试通知发送失败: ' + error.message);

      // 移动端详细错误分析
      if (envInfo.isMobile) {
        this.analyzeMobileNotificationError(error);
      }
    }
  },

  // 移动端故障排除指南
  showMobileTroubleshooting() {
    const troubleshootingSteps = [
      '1. 检查系统设置 → 通知 → 浏览器应用',
      '2. 检查浏览器设置 → 网站设置 → 通知',
      '3. 确保浏览器在后台运行权限',
      '4. 尝试重新申请通知权限',
      '5. 重启浏览器后再次测试',
    ];

    console.log('移动端故障排除步骤:');
    troubleshootingSteps.forEach(step => console.log(step));

    toastr.warning('移动端通知故障排除：\n' + troubleshootingSteps.join('\n'));
  },

  // 移动端错误分析
  analyzeMobileNotificationError(error) {
    console.log('移动端通知错误分析:');

    const errorAnalysis = {
      TypeError: {
        reason: '通知选项不兼容或API调用错误',
        solutions: ['尝试使用更简单的通知配置', '检查浏览器版本是否过旧', '确认Notification API完全支持'],
      },
      NotAllowedError: {
        reason: '权限被拒绝或系统限制',
        solutions: ['检查系统通知设置', '检查浏览器通知权限', '重新申请通知权限'],
      },
      AbortError: {
        reason: '通知被系统中止',
        solutions: ['检查勿扰模式设置', '检查电池优化设置', '确保浏览器有后台运行权限'],
      },
      InvalidStateError: {
        reason: '通知服务状态异常',
        solutions: ['重启浏览器', '清除浏览器缓存', '检查Service Worker状态'],
      },
    };

    const analysis = errorAnalysis[error.name] || {
      reason: '未知错误类型',
      solutions: ['尝试重启浏览器', '检查系统和浏览器设置', '联系技术支持'],
    };

    console.log(`错误类型: ${error.name}`);
    console.log(`可能原因: ${analysis.reason}`);
    console.log('解决方案:');
    analysis.solutions.forEach((solution, index) => {
      console.log(`${index + 1}. ${solution}`);
    });

    // 显示用户友好的错误信息
    const userMessage = `通知错误分析：\n原因：${analysis.reason}\n解决方案：\n${analysis.solutions
      .map((s, i) => `${i + 1}. ${s}`)
      .join('\n')}`;
    toastr.error(userMessage);
  },

  // 简化测试通知（专门针对移动端）
  async testSimpleNotification() {
    const envInfo = NotificationManager.getEnvironmentInfo();
    console.log('简化测试通知 - 移动端专用:', envInfo);

    if (!NotificationManager.checkSupport()) {
      toastr.error('此浏览器不支持通知功能');
      return;
    }

    const permission = NotificationManager.checkPermission();
    if (permission !== 'granted') {
      toastr.warning('请先申请通知权限');
      return;
    }

    try {
      console.log('使用最简配置创建通知...');

      // 使用最简单的配置，移除所有可能导致问题的选项
      const notification = new Notification('简化测试', {
        body: '这是最简化的测试通知',
      });

      console.log('简化通知创建成功:', notification);

      // 基本事件监听
      notification.onshow = function () {
        console.log('简化通知显示成功');
        toastr.success('简化通知显示成功！');
      };

      notification.onerror = function (error) {
        console.error('简化通知显示失败:', error);
        toastr.error('简化通知显示失败');
      };

      notification.onclick = function () {
        console.log('简化通知被点击');
        this.close();
      };

      // 移动端自动关闭
      if (envInfo.isMobile) {
        setTimeout(() => {
          try {
            notification.close();
            console.log('简化通知自动关闭');
          } catch (e) {
            console.warn('关闭简化通知失败:', e);
          }
        }, 5000);
      }

      toastr.info('简化测试通知已发送，使用最基本配置');
    } catch (error) {
      console.error('简化测试通知失败:', error);
      console.error('即使是最简配置也失败，可能的原因:');
      console.error('1. 系统级别的通知被禁用');
      console.error('2. 浏览器的通知功能被限制');
      console.error('3. 移动端浏览器的特殊限制');

      toastr.error(`简化测试也失败: ${error.message}\n这可能是系统或浏览器级别的限制`);

      // 提供最终的故障排除建议
      setTimeout(() => {
        toastr.warning(
          '最终建议：\n1. 检查手机系统设置→通知→Chrome\n2. 检查Chrome设置→网站设置→通知\n3. 重启Chrome浏览器\n4. 尝试其他支持的浏览器',
        );
      }, 2000);
    }
  },

  // 移动端环境检查
  async checkMobileEnvironment() {
    const results = await MobileNotificationChecker.checkMobileNotificationEnvironment();
    MobileNotificationChecker.displayCheckResults(results);
  },

  // Chrome 136修复测试
  async testChrome136Fix() {
    const chrome136Check = Chrome136NotificationFixer.checkChrome136Environment();

    if (chrome136Check.isChrome136) {
      console.log('开始Chrome 136通知修复...');
      const fixResult = await Chrome136NotificationFixer.fixChrome136Notification();

      if (fixResult) {
        toastr.success('Chrome 136通知修复测试完成！');
      } else {
        toastr.error('Chrome 136通知修复失败，请查看控制台了解详情');
      }
    } else {
      toastr.info('当前不是Chrome 136，无需特殊修复');
    }
  },

  // ServiceWorker通知测试
  async testServiceWorkerNotification() {
    const envInfo = NotificationManager.getEnvironmentInfo();
    console.log('测试ServiceWorker通知:', envInfo);

    if (!NotificationManager.checkSupport()) {
      toastr.error('此浏览器不支持通知功能');
      return;
    }

    const permission = NotificationManager.checkPermission();
    if (permission !== 'granted') {
      toastr.warning('请先申请通知权限');
      return;
    }

    try {
      console.log('强制使用ServiceWorker通知...');

      // 直接调用ServiceWorker通知方法
      await NotificationManager.sendViaServiceWorker(
        '🔧 ServiceWorker测试',
        'Chrome 136移动端专用ServiceWorker通知测试',
      );

      console.log('ServiceWorker通知发送成功');
      toastr.success('ServiceWorker通知已发送！这应该能解决Chrome 136移动端的问题');
    } catch (error) {
      console.error('ServiceWorker通知测试失败:', error);
      toastr.error('ServiceWorker通知失败: ' + error.message);

      // 提供详细的故障排除建议
      if (error.message.includes('ServiceWorker不支持')) {
        toastr.warning('您的浏览器不支持ServiceWorker，这可能是问题的根源');
      } else {
        toastr.info('ServiceWorker通知失败，建议：\n1. 重启浏览器\n2. 清除缓存\n3. 检查HTTPS环境');
      }
    }
  },
};

// 当扩展加载时调用此函数
jQuery(() => InitManager.init());
