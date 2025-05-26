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
  enableErrorSound: true, // 添加错误提示音功能的默认值
};

// 音频管理器
const AudioManager = {
  errorSound: null,

  init() {
    this.errorSound = new Audio('/sounds/message.mp3');
    this.errorSound.volume = 0.5;
  },

  playError() {
    if (extension_settings[extensionName].enableErrorSound && this.errorSound) {
      this.errorSound.currentTime = 0;
      this.errorSound.play().catch(err => console.error('播放错误提示音失败:', err));
    }
  },
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
      isLocalhost: location.hostname === 'localhost' || location.hostname === '127.0.0.1',
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
  async send(title = 'SillyTavern 新消息', body = '您有新的消息', options = {}) {
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

      // 移动端优化的通知选项
      const notificationOptions = {
        body: body,
        icon: '/favicon.ico',
        tag: 'silly-tavern-message',
        requireInteraction: envInfo.isMobile ? false : true, // 移动端设为false
        silent: false,
        ...options,
      };

      // 移动端可能需要更简单的选项
      if (envInfo.isMobile) {
        // 移除一些移动端可能不支持的选项
        delete notificationOptions.vibrate;
        delete notificationOptions.actions;
      }

      console.log('通知选项:', notificationOptions);

      const notification = new Notification(title, notificationOptions);

      notification.onclick = function () {
        console.log('通知被点击');
        window.focus();
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

      // 移动端自动关闭时间更短
      if (envInfo.isMobile) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      return notification;
    } catch (error) {
      console.error('发送通知时出错:', error);

      // 详细的错误信息
      if (this.isMobile()) {
        console.error('移动端通知错误，可能的原因:');
        console.error('1. 浏览器不支持Web Notification');
        console.error('2. 需要HTTPS环境');
        console.error('3. 浏览器设置禁用了通知');
        console.error('4. 移动端浏览器限制');
      }

      return null;
    }
  },

  // 发送错误通知
  sendError(error) {
    const errorMessage = error?.message || '未知错误';
    this.send('SillyTavern 发生错误', `错误信息: ${errorMessage}`);
    AudioManager.playError();
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
    $('#error_sound_setting').prop('checked', extension_settings[extensionName].enableErrorSound);
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

// 初始化管理器
const InitManager = {
  async init() {
    try {
      // 初始化错误处理器和音频管理器
      ErrorHandler.init();
      AudioManager.init();

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
    }

    // 开发模式下显示调试信息
    if (envInfo.isLocalhost || window.location.search.includes('debug=true')) {
      $('#debug_info_section').show();
    }
  },

  bindEventListeners() {
    // 原有的事件监听
    $('#title_reminder_setting').on('input', EventHandler.onReminderToggle);
    $('#notification_setting').on('input', EventHandler.onNotificationToggle);
    $('#error_sound_setting').on('input', event => {
      const value = Boolean($(event.target).prop('checked'));
      SettingsManager.save('enableErrorSound', value);
    });
    $('#request_notification_permission').on('click', EventHandler.onRequestPermissionClick);

    // 新增的调试功能事件监听
    $('#show_debug_info').on('click', this.showDebugInfo);
    $('#test_notification').on('click', this.testNotification);
  },

  showDebugInfo() {
    const envInfo = NotificationManager.getEnvironmentInfo();
    const debugOutput = $('#debug_output');

    const debugInfo = {
      环境信息: envInfo,
      扩展设置: extension_settings[extensionName],
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

    try {
      const notification = await NotificationManager.send('测试通知', '这是一条测试通知，用于验证通知功能是否正常工作');

      if (notification) {
        toastr.success('测试通知已发送');
      } else {
        toastr.error('测试通知发送失败');
      }
    } catch (error) {
      console.error('测试通知失败:', error);
      toastr.error('测试通知发送失败: ' + error.message);
    }
  },
};

// 当扩展加载时调用此函数
jQuery(() => InitManager.init());
