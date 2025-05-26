# SillyTavern 消息提醒扩展 | SillyTavern Message Reminder Extension

一个为 SillyTavern 提供消息提醒功能的扩展。

A SillyTavern extension that provides message reminder functionality.

## 功能特点 | Features

- 📢 标题栏闪烁提醒 | Title bar flashing reminder
  - 当切换到其他标签页时，收到新消息会通过闪烁标题提醒
  
  - When switched to other tabs, new messages will be reminded by flashing title

- 🔔 系统通知提醒 | System notification
  - 当切换到其他标签页时，收到新消息会通过系统通知提醒
  
  - When switched to other tabs, new messages will be reminded by system notification

## 移动端兼容性说明 | Mobile Compatibility

### 支持情况 | Support Status

- ✅ **Android Chrome 59+**: 完全支持
- ✅ **Android Firefox 68+**: 完全支持  
- ⚠️ **iOS Safari 16.4+**: 部分支持（需要用户手动启用）
- ❌ **iOS Safari < 16.4**: 不支持
- ⚠️ **其他移动浏览器**: 支持情况不一

### 移动端要求 | Mobile Requirements

1. **HTTPS环境**: 移动端浏览器严格要求HTTPS协议
2. **现代浏览器**: 建议使用Chrome、Firefox等现代浏览器
3. **系统版本**: iOS需要16.4+，Android需要7.0+
4. **浏览器设置**: 需要在浏览器设置中允许通知

### 移动端故障排除 | Mobile Troubleshooting

#### 问题1: 权限申请弹窗不出现
**可能原因:**
- 浏览器不支持Web Notification API
- 当前环境不是HTTPS
- 浏览器设置禁用了通知权限申请

**解决方案:**
1. 确保使用HTTPS访问网站
2. 使用Chrome或Firefox等现代浏览器
3. 检查浏览器设置中的通知权限

#### 问题2: 权限已授予但通知不显示
**可能原因:**
- 系统级别的通知被禁用
- 浏览器的通知被禁用
- 移动端浏览器的后台限制

**解决方案:**
1. 检查手机系统设置 → 通知 → 浏览器应用
2. 检查浏览器设置 → 网站设置 → 通知
3. 确保浏览器应用在后台运行权限

#### 问题3: iOS设备通知不工作
**可能原因:**
- iOS版本低于16.4
- Safari的Web通知功能未启用
- 网站未添加到主屏幕

**解决方案:**
1. 升级iOS到16.4或更高版本
2. 在Safari设置中启用通知
3. 将网站添加到主屏幕（PWA模式）

### 调试工具 | Debug Tools

扩展提供了调试工具来帮助诊断问题：

1. **环境信息检查**: 显示当前设备和浏览器的详细信息
2. **通知测试**: 手动测试通知功能是否正常
3. **控制台日志**: 详细的调试信息输出

要启用调试模式，在URL后添加 `?debug=true` 参数。

### 🔧 **Chrome 136 移动端特殊问题**

**问题描述**: Chrome 136移动端出现 `"Illegal constructor. Use ServiceWorkerRegistration.showNotification() instead"` 错误

**解决方案**:
1. **自动检测**: 扩展会自动检测Chrome 136移动端并使用ServiceWorker通知
2. **手动测试**: 点击"SW通知测试"按钮强制使用ServiceWorker通知
3. **Chrome 136修复**: 点击"Chrome 136修复"按钮应用专门的修复方案

**技术原理**: Chrome 136移动端要求使用`ServiceWorkerRegistration.showNotification()`而不是`new Notification()`

## 安装方法 | Installation

1. 打开 SillyTavern 扩展管理页面

   Open SillyTavern Extension Management page

2. 点击"从 URL 安装"

   Click "Install from URL"

3. 输入本扩展的 GitHub 仓库地址

   Input this extension's GitHub repository URL

4. 点击安装

   Click Install

## 使用方法 | Usage

1. 在设置中启用扩展

   Enable the extension in settings

2. 根据需要开启或关闭各种提醒方式

   Enable or disable different reminder methods as needed

3. 如需使用系统通知，请点击"申请通知权限"按钮

   If you want to use system notifications, please click the "Request Notification Permission" button

4. **移动端用户**: 确保使用HTTPS环境和支持的浏览器

   **Mobile users**: Make sure to use HTTPS environment and supported browsers

## 系统要求 | Prerequisites

- SillyTavern 1.9.0 或更高版本

  SillyTavern 1.9.0 or higher

- 现代浏览器（支持 Notifications API）

  Modern browser (with Notifications API support)

- **移动端**: HTTPS环境 + Chrome/Firefox + iOS 16.4+/Android 7.0+

  **Mobile**: HTTPS environment + Chrome/Firefox + iOS 16.4+/Android 7.0+

## 常见问题 | FAQ

### Q: 为什么移动端通知不工作？
A: 请检查以下几点：
1. 是否使用HTTPS访问
2. 浏览器是否支持Web Notification
3. 是否已正确授予通知权限
4. 系统和浏览器的通知设置是否正确

### Q: iOS设备如何启用通知？
A: 
1. 确保iOS版本为16.4或更高
2. 在Safari设置中启用通知
3. 将网站添加到主屏幕
4. 在系统设置中允许Safari的通知权限

### Q: Android设备通知不稳定怎么办？
A: 
1. 在系统设置中关闭浏览器的电池优化
2. 允许浏览器在后台运行
3. 检查系统的勿扰模式设置

## 支持与贡献 | Support & Contribution

如果您遇到问题或有任何建议，欢迎：

If you encounter any issues or have suggestions, feel free to:

- 在 GitHub 上提交 Issue

  Submit an Issue on GitHub

- 提交 Pull Request 来改进代码

  Submit a Pull Request to improve the code

## 许可证 | License

MIT License
