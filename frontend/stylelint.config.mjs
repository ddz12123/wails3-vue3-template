/** Stylelint 配置：覆盖 Vue SFC 样式块与独立 CSS/SCSS 文件 */
export default {
  extends: ['stylelint-config-recommended-vue/scss'],
  rules: {
    // 模板内类名沿用 BEM / kebab 混合风格，不强制统一命名模式
    'selector-class-pattern': null,
  },
};
