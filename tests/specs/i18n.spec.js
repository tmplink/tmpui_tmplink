/**
 * i18n.spec.js — i18n 键对齐测试
 * 检查 cn/en/hk/jp 四个语言文件的键集一致性、值有效性、命名规范
 */
// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const LANG_DIR = path.resolve(__dirname, '..', '..', 'json');
const LANG_FILES = ['cn.json', 'en.json', 'hk.json', 'jp.json'];

/** 读取并解析 JSON 语言文件 */
function loadLangFile(filename) {
  const filePath = path.join(LANG_DIR, filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

test.describe('i18n 键对齐检查', () => {
  /** @type {Record<string, Record<string, string>>} */
  const langData = {};

  test.beforeAll(() => {
    for (const file of LANG_FILES) {
      langData[file] = loadLangFile(file);
    }
  });

  test('所有语言文件可正常解析', () => {
    for (const file of LANG_FILES) {
      expect(langData[file]).toBeTruthy();
      expect(typeof langData[file]).toBe('object');
    }
  });

  test('四个语言文件的键集完全一致', () => {
    const keySets = {};
    for (const file of LANG_FILES) {
      keySets[file] = new Set(Object.keys(langData[file]));
    }

    const referenceFile = LANG_FILES[0];
    const referenceKeys = keySets[referenceFile];
    const mismatches = [];

    for (const file of LANG_FILES) {
      if (file === referenceFile) continue;
      const currentKeys = keySets[file];

      // 在 reference 中但不在 current 中
      for (const key of referenceKeys) {
        if (!currentKeys.has(key)) {
          mismatches.push(`键 "${key}" 存在于 ${referenceFile} 但缺失于 ${file}`);
        }
      }

      // 在 current 中但不在 reference 中
      for (const key of currentKeys) {
        if (!referenceKeys.has(key)) {
          mismatches.push(`键 "${key}" 存在于 ${file} 但缺失于 ${referenceFile}`);
        }
      }
    }

    if (mismatches.length > 0) {
      const report = mismatches.join('\n  ');
      expect(mismatches, `i18n 键不一致:\n  ${report}`).toHaveLength(0);
    }
  });

  test('所有值为非空字符串', () => {
    const emptyValues = [];

    for (const file of LANG_FILES) {
      const data = langData[file];
      for (const [key, value] of Object.entries(data)) {
        if (typeof value !== 'string') {
          emptyValues.push(`${file}: "${key}" 类型为 ${typeof value}，预期 string`);
        } else if (value.trim() === '') {
          emptyValues.push(`${file}: "${key}" 为空字符串`);
        }
      }
    }

    if (emptyValues.length > 0) {
      const report = emptyValues.join('\n  ');
      expect(emptyValues, `发现空值或非字符串值:\n  ${report}`).toHaveLength(0);
    }
  });

  test('键名符合小写下划线命名规范', () => {
    const invalidKeys = [];
    const validPattern = /^[a-z][a-z0-9_]*$/;

    // 只需检查一个文件（键集一致性在上面的测试中保证）
    const data = langData[LANG_FILES[0]];
    for (const key of Object.keys(data)) {
      if (!validPattern.test(key)) {
        invalidKeys.push(key);
      }
    }

    if (invalidKeys.length > 0) {
      const report = invalidKeys.join(', ');
      expect(invalidKeys, `不符合命名规范的键: ${report}`).toHaveLength(0);
    }
  });

  test('各语言文件键数量一致', () => {
    const counts = {};
    for (const file of LANG_FILES) {
      counts[file] = Object.keys(langData[file]).length;
    }

    const values = Object.values(counts);
    const allSame = values.every((v) => v === values[0]);
    expect(allSame, `键数量不一致: ${JSON.stringify(counts)}`).toBe(true);
  });
});
