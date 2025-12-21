/**
 * 将目录名（或文件名）翻译成自定义名称
 *
 * ! 由于自动路由脚本是按照字典序排列。
 * ! 如果想要实现特定的顺序，请在文件或目录前人为排序。
 * ! 并在该文件中将其名称进行替换。
 */
export const fileName2Title: Record<string, string> = {
  AI: '\ud83e\udd16 AI',
  Java: '\u2615 Java',
  MQ: '\ud83d\udcec MQ / 消息队列',
  work: '\ud83d\udcbc 工作记录',
  基础: '\ud83d\udcd6 计算机基础',
  架构: '\ud83d\uddfd 架构',
  站外文档: '\ud83d\udd17 站外文档',
  简历: '\ud83d\udcc4 简历',
  算法: '\ud83e\udde0 算法',
  面经: '\ud83d\udcdd 面经'
};
