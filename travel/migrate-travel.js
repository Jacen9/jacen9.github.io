/**
 * Travel 文件迁移脚本
 * 
 * 将现有文件按照新的命名规范重命名：
 * - spot/folk 目录：type-name-comment 或 type-name-rating-comment
 * - food/museum 图片：type-name-comment.jpg 或 type-name-rating-comment.jpg
 * 
 * 同时生成城市配置文件（config）
 */

const fs = require('fs');
const path = require('path');

// 配置路径
const PHOTO_DIR = path.join(__dirname, 'photo');
const OLD_CONFIG_FILE = path.join(__dirname, 'data.json');

// 直辖市和特别行政区
const MUNICIPALITIES = ['北京市', '天津市', '上海市', '重庆市', '香港特别行政区', '澳门特别行政区', '台湾省'];

// 需要排除的文件名
const EXCLUDE_NAMES = ['cover.jpg', 'cover.png', 'cover.jpeg', 'cover.webp', 'cover.JPG', 'config'];

// 判断是否为直辖市
function isMunicipality(name) {
  return MUNICIPALITIES.includes(name);
}

// 检查是否为有效的图片文件
function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
}

// 生成新的 item 名称
function generateItemName(type, name, comment, rating) {
  const parts = [type, name];
  if (rating) {
    parts.push(rating);
  }
  if (comment) {
    parts.push(comment);
  }
  return parts.join('-');
}

// 检查目录/文件是否已经按新格式命名
function isNewFormat(name) {
  // 移除扩展名
  const baseName = name.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
  const parts = baseName.split('-');
  if (parts.length < 2) return false;
  const type = parts[0];
  return ['spot', 'food', 'museum', 'folk'].includes(type);
}

// 安全重命名（处理已存在的情况）
function safeRename(oldPath, newPath) {
  if (oldPath === newPath) {
    return { success: false, reason: 'same' };
  }
  
  if (fs.existsSync(newPath)) {
    return { success: false, reason: 'exists' };
  }
  
  try {
    fs.renameSync(oldPath, newPath);
    return { success: true };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

// 迁移城市的 items
function migrateCityItems(provinceName, cityName, cityPath, items) {
  if (!items || items.length === 0) return { dirs: 0, files: 0, errors: [] };
  
  const stats = { dirs: 0, files: 0, errors: [] };
  const entries = fs.readdirSync(cityPath, { withFileTypes: true });
  
  for (const item of items) {
    const type = item.type || 'spot';
    const name = item.name;
    const comment = item.comment || '';
    const rating = item.rating || '';
    
    const newItemName = generateItemName(type, name, comment, rating);
    
    if (type === 'spot' || type === 'folk') {
      // 多图类型：查找目录
      // 匹配策略：精确匹配名称，或包含名称的目录
      let matchedDir = null;
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (EXCLUDE_NAMES.some(ex => entry.name === ex)) continue;
        if (isNewFormat(entry.name)) continue;
        
        const dirName = entry.name;
        // 精确匹配
        if (dirName === name) {
          matchedDir = entry;
          break;
        }
        // 包含匹配
        if (dirName.includes(name) || name.includes(dirName)) {
          if (!matchedDir) {
            matchedDir = entry;
          }
        }
      }
      
      if (matchedDir) {
        const oldPath = path.join(cityPath, matchedDir.name);
        const newPath = path.join(cityPath, newItemName);
        const result = safeRename(oldPath, newPath);
        
        if (result.success) {
          console.log(`    [目录] ${matchedDir.name} -> ${newItemName}`);
          stats.dirs++;
        } else if (result.reason === 'exists') {
          console.log(`    [跳过] ${newItemName} 已存在`);
        } else if (result.reason !== 'same') {
          stats.errors.push(`${matchedDir.name}: ${result.reason}`);
        }
      } else {
        // 未找到匹配的目录，可能需要手动处理
        stats.errors.push(`未找到目录: ${name}`);
      }
    } else if (type === 'food' || type === 'museum') {
      // 单图类型：查找图片
      let matchedFile = null;
      
      for (const entry of entries) {
        if (entry.isDirectory()) continue;
        if (EXCLUDE_NAMES.some(ex => entry.name.toLowerCase() === ex.toLowerCase())) continue;
        if (isNewFormat(entry.name)) continue;
        if (!isImageFile(entry.name)) continue;
        
        const fileName = entry.name;
        const baseName = path.parse(fileName).name;
        
        // 精确匹配
        if (baseName === name) {
          matchedFile = entry;
          break;
        }
        // 包含匹配
        if (baseName.includes(name) || name.includes(baseName)) {
          if (!matchedFile) {
            matchedFile = entry;
          }
        }
      }
      
      if (matchedFile) {
        const ext = path.extname(matchedFile.name).toLowerCase();
        const oldPath = path.join(cityPath, matchedFile.name);
        const newPath = path.join(cityPath, newItemName + ext);
        const result = safeRename(oldPath, newPath);
        
        if (result.success) {
          console.log(`    [文件] ${matchedFile.name} -> ${newItemName}${ext}`);
          stats.files++;
        } else if (result.reason === 'exists') {
          console.log(`    [跳过] ${newItemName}${ext} 已存在`);
        } else if (result.reason !== 'same') {
          stats.errors.push(`${matchedFile.name}: ${result.reason}`);
        }
      } else {
        // 未找到匹配的文件，可能需要手动处理
        stats.errors.push(`未找到文件: ${name}`);
      }
    }
  }
  
  return stats;
}

// 生成城市配置文件
function generateCityConfig(cityPath, date, comment) {
  const configPath = path.join(cityPath, 'config');
  
  // 如果已存在配置文件，先读取并合并
  let existingConfig = { date: '', comment: '' };
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
          const key = trimmed.substring(0, colonIndex).trim();
          const value = trimmed.substring(colonIndex + 1).trim();
          if (key === 'date') existingConfig.date = value;
          if (key === 'comment') existingConfig.comment = value;
        }
      }
    } catch (err) {
      // 忽略错误
    }
  }
  
  // 合并配置（新值优先，但保留旧值如果新值为空）
  const finalDate = date || existingConfig.date;
  const finalComment = comment || existingConfig.comment;
  
  // 只有当有内容时才写入
  if (finalDate || finalComment) {
    let content = '# 城市配置文件\n';
    content += '# 格式: key: value\n\n';
    if (finalDate) {
      content += `date: ${finalDate}\n`;
    }
    if (finalComment) {
      content += `comment: ${finalComment}\n`;
    }
    
    fs.writeFileSync(configPath, content, 'utf-8');
    console.log('    [配置] 生成 config 文件');
    return true;
  }
  return false;
}

// 迁移城市
function migrateCity(city) {
  const province = city.province;
  const name = city.name;
  
  let cityPath;
  if (isMunicipality(province)) {
    cityPath = path.join(PHOTO_DIR, province);
  } else {
    cityPath = path.join(PHOTO_DIR, province, name);
  }
  
  if (!fs.existsSync(cityPath)) {
    return { status: 'skipped', reason: '目录不存在' };
  }
  
  // 检查是否有 cover.jpg（visited 标记）
  const entries = fs.readdirSync(cityPath, { withFileTypes: true });
  const hasCover = entries.some(e => 
    !e.isDirectory() && e.name.toLowerCase() === 'cover.jpg'
  );
  
  if (!hasCover) {
    return { status: 'skipped', reason: '未访问（无 cover.jpg）' };
  }
  
  console.log(`\n处理: ${province} - ${name}`);
  
  // 生成城市配置文件
  if (city.date || city.comment) {
    generateCityConfig(cityPath, city.date, city.comment);
  }
  
  // 获取 items（兼容旧格式）
  let items = city.items || [];
  if (city.spots && city.spots.length > 0) {
    // 将 spots 转换为 items
    const spotItems = city.spots.map(s => ({ ...s, type: 'spot' }));
    items = [...items, ...spotItems];
  }
  
  // 迁移 items
  if (items.length > 0) {
    const stats = migrateCityItems(province, name, cityPath, items);
    return {
      status: 'success',
      dirs: stats.dirs,
      files: stats.files,
      errors: stats.errors
    };
  }
  
  return { status: 'success', dirs: 0, files: 0, errors: [] };
}

// 主函数
function main() {
  console.log('开始迁移 travel 文件...');
  console.log('='.repeat(60));
  
  if (!fs.existsSync(OLD_CONFIG_FILE)) {
    console.error('错误: 找不到旧配置文件 data.json');
    return;
  }
  
  const content = fs.readFileSync(OLD_CONFIG_FILE, 'utf-8');
  const data = JSON.parse(content);
  const cities = data.cities || [];
  
  const visitedCities = cities.filter(c => c.visited);
  console.log(`\n共 ${cities.length} 个城市配置，${visitedCities.length} 个已访问\n`);
  
  const summary = {
    total: visitedCities.length,
    success: 0,
    skipped: 0,
    totalDirs: 0,
    totalFiles: 0,
    errors: []
  };
  
  for (const city of visitedCities) {
    const result = migrateCity(city);
    
    if (result.status === 'success') {
      summary.success++;
      summary.totalDirs += result.dirs || 0;
      summary.totalFiles += result.files || 0;
      if (result.errors && result.errors.length > 0) {
        summary.errors.push(...result.errors.map(e => `${city.name}: ${e}`));
      }
    } else if (result.status === 'skipped') {
      summary.skipped++;
      console.log(`跳过: ${city.province} - ${city.name} (${result.reason})`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n迁移完成！');
  console.log(`- 处理城市: ${summary.success}/${summary.total}`);
  console.log(`- 跳过城市: ${summary.skipped}`);
  console.log(`- 重命名目录: ${summary.totalDirs}`);
  console.log(`- 重命名文件: ${summary.totalFiles}`);
  
  if (summary.errors.length > 0) {
    console.log(`\n警告/错误 (${summary.errors.length}):`);
    summary.errors.slice(0, 20).forEach(e => console.log(`  - ${e}`));
    if (summary.errors.length > 20) {
      console.log(`  ... 还有 ${summary.errors.length - 20} 条`);
    }
  }
  
  console.log('\n下一步:');
  console.log('1. 检查重命名结果是否正确');
  console.log('2. 运行 node scan-travel.js 生成新配置');
  console.log('3. 确认无误后，将 data-scanned.json 重命名为 data.json');
}

main();
