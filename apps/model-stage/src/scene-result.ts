export function describeProjectionWarning(
  status: string,
  modelFailureCount: number
): string | null {
  if (status === 'ready') return null
  const failedModels = modelFailureCount > 0 ? `${modelFailureCount} 个模型` : '部分模型'
  if (status === 'partial') return `修改已提交，但${failedModels}未能更新到画面`
  if (status === 'failed') {
    return modelFailureCount > 0
      ? `修改已提交，但${failedModels}加载失败；可以撤销后重试`
      : '修改已提交，但运行时画面更新失败；可以撤销后重试'
  }
  if (status === 'cancelled') return '修改已提交，但本次画面更新被取消'
  if (status === 'queued' || status === 'loading') return '修改已提交，运行时画面仍在更新'
  if (status === 'skipped') return '修改已提交，但运行时没有执行画面投影'
  return `修改已提交，但运行时返回了未知画面状态：${status}`
}
