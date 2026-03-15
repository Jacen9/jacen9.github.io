/**
 * Travel 配置生成脚本
 * 
 * 目录结构规范：
 * - 省级目录：photo/省名/（直辖市和港澳台属于省级）
 * - 市级目录：photo/省名/市名/
 *   - cover.jpg 存在表示 visited = true
 *   - config 文件存储 date 和 comment
 * 
 * Items 配置：
 * - spot/folk（多图目录）：type-name-comment 或 type-name-rating-comment
 *   - 例如：spot-故宫-紫禁城 / folk-舞龙-春节民俗
 * - food/museum/animal（单图文件）：type-name-comment.jpg 或 type-name-rating-comment.jpg
 *   - 例如：food-烤鸭-皮脆肉嫩.jpg / museum-青铜鼎-商代文物.jpg / animal-熊猫-国宝.jpg
 */

const fs = require('fs');
const path = require('path');

// 配置路径
const PHOTO_DIR = path.join(__dirname, 'photo');
const OUTPUT_FILE = path.join(__dirname, 'data.json');
const OLD_CONFIG_FILE = path.join(__dirname, 'data.json');

// 直辖市和特别行政区
const MUNICIPALITIES = ['北京市', '天津市', '上海市', '重庆市', '香港特别行政区', '澳门特别行政区', '台湾省'];

// 需要排除的文件名
const EXCLUDE_NAMES = ['cover.jpg', 'cover.png', 'cover.jpeg', 'cover.webp', 'cover.JPG', 'config'];

// 图片扩展名
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.JPG', '.JPEG', '.PNG', '.WEBP', '.GIF'];

// 判断是否为直辖市
function isMunicipality(name) {
  return MUNICIPALITIES.includes(name);
}

// 判断是否为有效的图片文件
function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
}

// 解析 item 名称格式：type-name-comment 或 type-name-rating-comment
// 支持多种格式：
// - spot-故宫-紫禁城
// - spot-故宫-5-紫禁城
// - food-烤鸭.jpg (只有类型和名称)
// - food-烤鸭-皮脆肉嫩.jpg
// - food-烤鸭-5-皮脆肉嫩.jpg
function parseItemName(basename) {
  // 移除扩展名（如果有）
  const name = basename.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
  const parts = name.split('-');
  
  if (parts.length < 2) {
    return null; // 格式不正确
  }
  
  const type = parts[0];
  
  // 验证类型
  if (!['spot', 'food', 'museum', 'folk', 'animal'].includes(type)) {
    return null;
  }
  
  // 重新组合剩余部分
  const remaining = parts.slice(1);
  
  let item_name = '';
  let rating = '';
  let comment = '';
  
  // 尝试找 rating（纯数字或数字+星/分）
  let foundRating = false;
  for (let i = 1; i < remaining.length; i++) {
    const part = remaining[i];
    const ratingMatch = part.match(/^(\d+(\.\d+)?)(星|分)?$/);
    if (ratingMatch) {
      rating = ratingMatch[1];
      item_name = remaining.slice(0, i).join('-');
      comment = remaining.slice(i + 1).join('-');
      foundRating = true;
      break;
    }
  }
  
  if (!foundRating) {
    // 没有找到 rating
    // 尝试识别：最后一个部分可能是 comment，也可能是 name 的一部分
    // 假设格式是 name-comment 或 name-rating-comment
    if (remaining.length >= 2) {
      // 检查倒数第二个是否为 rating
      const possibleRating = remaining[remaining.length - 2];
      const ratingMatch = possibleRating && possibleRating.match(/^(\d+(\.\d+)?)(星|分)?$/);
      
      if (ratingMatch) {
        rating = ratingMatch[1];
        item_name = remaining.slice(0, remaining.length - 2).join('-');
        comment = remaining[remaining.length - 1];
      } else {
        // 最后一个是 comment
        item_name = remaining.slice(0, -1).join('-');
        comment = remaining[remaining.length - 1];
      }
    } else {
      // 只有一个部分，就是 name
      item_name = remaining[0];
    }
  }
  
  return { type, name: item_name, rating, comment };
}

// 扫描 item 目录下的图片文件
function scanItemPhotos(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  
  const photos = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.map(e => e.toLowerCase()).includes(ext)) {
        photos.push(entry.name);
      }
    }
  }
  
  // 按文件名排序
  photos.sort((a, b) => {
    // 数字命名的按数字排序
    const numA = parseInt(path.parse(a).name);
    const numB = parseInt(path.parse(b).name);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.localeCompare(b);
  });
  
  return photos;
}

// 解析城市配置文件
function parseCityConfig(configPath) {
  const config = { date: '', comment: '' };
  
  if (!fs.existsSync(configPath)) {
    return config;
  }
  
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
        
        if (key === 'date') {
          config.date = value;
        } else if (key === 'comment') {
          config.comment = value;
        }
      }
    }
  } catch (err) {
    console.warn(`读取配置文件失败: ${configPath}`);
  }
  
  return config;
}

// 扫描市级目录
function scanCityDir(provinceName, cityName, cityPath) {
  const city = {
    name: cityName,
    province: provinceName,
    visited: false
  };
  
  if (!fs.existsSync(cityPath)) {
    return city;
  }
  
  const entries = fs.readdirSync(cityPath, { withFileTypes: true });
  
  // 检查是否有 cover.jpg（不区分大小写）
  const hasCover = entries.some(e => 
    !e.isDirectory() && 
    e.name.toLowerCase() === 'cover.jpg'
  );
  city.visited = hasCover;
  
  if (!city.visited) {
    return city;
  }
  
  // 读取城市配置
  const configPath = path.join(cityPath, 'config');
  const cityConfig = parseCityConfig(configPath);
  city.date = cityConfig.date;
  city.comment = cityConfig.comment;
  
  // 扫描 items
  const items = [];
  
  for (const entry of entries) {
    // 排除特定文件
    if (EXCLUDE_NAMES.some(ex => entry.name.toLowerCase() === ex.toLowerCase())) {
      continue;
    }
    
    const entryPath = path.join(cityPath, entry.name);
    
    if (entry.isDirectory()) {
      // 目录类型：spot 或 folk
      const parsed = parseItemName(entry.name);
      if (parsed && (parsed.type === 'spot' || parsed.type === 'folk')) {
        const item = {
          name: parsed.name,
          type: parsed.type
        };
        if (parsed.comment) item.comment = parsed.comment;
        if (parsed.rating) item.rating = parsed.rating;
        
        // 扫描目录下的图片文件
        const itemDirPath = path.join(cityPath, entry.name);
        const photos = scanItemPhotos(itemDirPath);
        if (photos.length > 0) {
          item.photos = photos;
        }
        
        items.push(item);
        console.log(`    发现 item: [${parsed.type}] ${parsed.name}${parsed.comment ? ' - ' + parsed.comment : ''} (${photos.length}张图片)`);
      }
    } else if (isImageFile(entry.name)) {
      // 图片文件：检查是否为 food 或 museum 类型
      const parsed = parseItemName(entry.name);
      if (parsed && (parsed.type === 'food' || parsed.type === 'museum' || parsed.type === 'animal')) {
        const item = {
          name: parsed.name,
          type: parsed.type
        };
        if (parsed.comment) item.comment = parsed.comment;
        if (parsed.rating) item.rating = parsed.rating;
        items.push(item);
        console.log(`    发现 item: [${parsed.type}] ${parsed.name}${parsed.comment ? ' - ' + parsed.comment : ''}`);
      }
    }
  }
  
  if (items.length > 0) {
    city.items = items;
  }
  
  return city;
}

// 扫描省级目录
function scanProvinceDir(provinceName, provincePath) {
  const cities = [];
  
  if (!fs.existsSync(provincePath)) {
    return cities;
  }
  
  // 直辖市：直接扫描本级
  if (isMunicipality(provinceName)) {
    console.log(`\n扫描直辖市: ${provinceName}`);
    const city = scanCityDir(provinceName, provinceName, provincePath);
    cities.push(city);
    return cities;
  }
  
  // 普通省份：扫描市级目录
  console.log(`\n扫描省份: ${provinceName}`);
  const entries = fs.readdirSync(provincePath, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const cityPath = path.join(provincePath, entry.name);
      console.log(`  城市: ${entry.name}`);
      const city = scanCityDir(provinceName, entry.name, cityPath);
      cities.push(city);
    }
  }
  
  return cities;
}

// 从旧配置中读取所有城市的定义（用于补全未访问的城市）
function getAllCitiesFromOldConfig() {
  if (!fs.existsSync(OLD_CONFIG_FILE)) {
    return [];
  }
  
  try {
    const content = fs.readFileSync(OLD_CONFIG_FILE, 'utf-8');
    const data = JSON.parse(content);
    return data.cities || [];
  } catch (err) {
    console.warn('读取旧配置文件失败:', err);
    return [];
  }
}

// 主函数
function main() {
  console.log('开始扫描 travel 配置...');
  console.log('='.repeat(50));
  
  const allCities = [];
  const visitedCities = [];
  
  // 扫描所有省级目录
  const provinces = fs.readdirSync(PHOTO_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort();
  
  console.log(`\n发现 ${provinces.length} 个省级目录`);
  
  for (const province of provinces) {
    const provincePath = path.join(PHOTO_DIR, province);
    const cities = scanProvinceDir(province, provincePath);
    
    cities.forEach(city => {
      allCities.push(city);
      if (city.visited) {
        visitedCities.push(city);
      }
    });
  }
  
  // 从旧配置中补全未在目录中存在的城市
  const oldCities = getAllCitiesFromOldConfig();
  const existingCityKeys = new Set(allCities.map(c => `${c.province}-${c.name}`));
  
  let addedFromOld = 0;
  for (const oldCity of oldCities) {
    const key = `${oldCity.province}-${oldCity.name}`;
    if (!existingCityKeys.has(key)) {
      allCities.push({
        name: oldCity.name,
        province: oldCity.province,
        visited: false
      });
      addedFromOld++;
    }
  }
  
  // 按 province 和 name 排序
  allCities.sort((a, b) => {
    if (a.province !== b.province) {
      return a.province.localeCompare(b.province, 'zh-CN');
    }
    return a.name.localeCompare(b.name, 'zh-CN');
  });
  
  // 生成新配置
  const newConfig = {
    _comment: "此文件由 scan-travel.js 自动生成，请勿手动编辑",
    _naming: {
      spot: "景点（多图卡片），目录命名：spot-名称-简介",
      food: "美食（单图紧凑），图片命名：food-名称-简介.jpg",
      museum: "博物（单图紧凑），图片命名：museum-名称-简介.jpg",
      folk: "民俗（多图卡片），目录命名：folk-名称-简介"
    },
    cities: allCities
  };
  
  // 写入文件
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');
  
  console.log('\n' + '='.repeat(50));
  console.log('\n扫描完成！');
  console.log(`- 总城市数: ${allCities.length}`);
  console.log(`- 已访问城市: ${visitedCities.length}`);
  console.log(`- 从旧配置补全: ${addedFromOld}`);
  console.log(`\n配置已保存到: ${OUTPUT_FILE}`);
}

main();
