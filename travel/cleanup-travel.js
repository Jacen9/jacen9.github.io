/**
 * Travel 文件清理脚本
 * 
 * 清理文件名中的问题：
 * - 移除尾随空格
 * - 移除多余的连字符
 */

const fs = require('fs');
const path = require('path');

const PHOTO_DIR = path.join(__dirname, 'photo');

// 清理文件/目录名
function cleanName(name) {
  let cleaned = name;
  
  // 移除 "空格-" 或 "-空格" 的模式
  cleaned = cleaned.replace(/\s+-/g, '-');
  cleaned = cleaned.replace(/-\s+/g, '-');
  
  // 移除尾随连字符
  cleaned = cleaned.replace(/-$/g, '');
  
  // 移除多余的连字符
  cleaned = cleaned.replace(/-+/g, '-');
  
  // 移除 ".-" 模式（在扩展名前）
  const ext = path.extname(cleaned);
  if (ext) {
    const base = path.basename(cleaned, ext);
    const cleanedBase = base.replace(/-+$/g, '');
    cleaned = cleanedBase + ext.toLowerCase();
  }
  
  return cleaned;
}

// 递归处理目录
function processDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      // 先递归处理子目录
      processDirectory(entryPath);
      
      // 检查是否需要重命名目录
      const cleanedName = cleanName(entry.name);
      if (cleanedName !== entry.name) {
        const newPath = path.join(dirPath, cleanedName);
        if (!fs.existsSync(newPath)) {
          console.log(`[目录] ${entry.name} -> ${cleanedName}`);
          fs.renameSync(entryPath, newPath);
        }
      }
    } else {
      // 检查是否需要重命名文件
      const cleanedName = cleanName(entry.name);
      if (cleanedName !== entry.name) {
        const newPath = path.join(dirPath, cleanedName);
        if (!fs.existsSync(newPath)) {
          console.log(`[文件] ${entry.name} -> ${cleanedName}`);
          fs.renameSync(entryPath, newPath);
        }
      }
    }
  }
}

// 主函数
function main() {
  console.log('开始清理文件名...\n');
  
  const provinces = fs.readdirSync(PHOTO_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);
  
  for (const province of provinces) {
    const provincePath = path.join(PHOTO_DIR, province);
    processDirectory(provincePath);
  }
  
  console.log('\n清理完成！');
}

main();
