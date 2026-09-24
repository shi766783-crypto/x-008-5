import { storage } from '../../core/storage.js'
import { uid, todayStr } from '../../core/utils.js'
import { STORAGE_KEYS, TRANSACTION_TYPES, EXPENSE_CATEGORIES } from '../../core/constants.js'
import { addTransaction } from './transactionController.js'

export const emptyTemplateForm = () => ({
  name: '',
  type: TRANSACTION_TYPES.EXPENSE,
  accountId: '',
  amount: '',
  category: EXPENSE_CATEGORIES[0],
  note: '',
  isLarge: false
})

export function loadTemplates() {
  return storage.getJSON(STORAGE_KEYS.templates) || []
}

export function saveTemplates(templates) {
  storage.setJSON(STORAGE_KEYS.templates, templates)
}

export function normalizeTemplate(form) {
  return {
    id: uid(),
    name: String(form.name || '').trim(),
    type: form.type === TRANSACTION_TYPES.INCOME ? TRANSACTION_TYPES.INCOME : TRANSACTION_TYPES.EXPENSE,
    accountId: form.accountId,
    amount: Number(form.amount) || 0,
    category: form.category,
    note: String(form.note || '').trim(),
    isLarge: Boolean(form.isLarge),
    createdAt: Date.now()
  }
}

export function addTemplate(form) {
  const template = normalizeTemplate(form)
  if (!template.name || !template.accountId || !template.amount) return null
  saveTemplates([...loadTemplates(), template])
  return template
}

export function removeTemplate(id, confirmFn = window.confirm) {
  const template = loadTemplates().find((t) => t.id === id)
  if (!template) return false
  if (!confirmFn(`确认删除快捷模板「${template.name}」吗？`)) return false
  saveTemplates(loadTemplates().filter((t) => t.id !== id))
  return true
}

// 模板引用的账户是否已被删除
export function isTemplateAccountMissing(template, accounts) {
  return !(accounts || []).some((a) => a.id === template.accountId)
}

// 账户被删后重新指定，持久化修复模板里的失效引用
export function retargetTemplate(id, accountId) {
  saveTemplates(loadTemplates().map((t) => (t.id === id ? { ...t, accountId } : t)))
}

// 按模板生成一笔流水；overrides（金额/日期/备注/大额）仅对本次生效，不写回模板
export function applyTemplate(template, overrides = {}) {
  return addTransaction({
    type: template.type,
    accountId: template.accountId,
    toAccountId: '',
    amount: overrides.amount ?? template.amount,
    category: template.category,
    date: overrides.date || todayStr(),
    note: overrides.note ?? template.note,
    isLarge: overrides.isLarge ?? template.isLarge
  })
}
