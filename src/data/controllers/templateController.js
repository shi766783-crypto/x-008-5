import { storage } from '../../core/storage.js'
import { uid, todayStr } from '../../core/utils.js'
import { STORAGE_KEYS, TRANSACTION_TYPES } from '../../core/constants.js'

export const emptyTemplateForm = () => ({
  name: '',
  type: TRANSACTION_TYPES.EXPENSE,
  accountId: '',
  amount: '',
  category: '餐饮',
  note: ''
})

export function loadTemplates() {
  return storage.getJSON(STORAGE_KEYS.templates) || []
}

export function saveTemplates(templates) {
  storage.setJSON(STORAGE_KEYS.templates, templates)
}

export function normalizeTemplate(form) {
  const note = String(form.note || '').trim()
  return {
    id: uid(),
    name: String(form.name || '').trim() || note || form.category || '未命名模板',
    type: form.type === TRANSACTION_TYPES.INCOME ? TRANSACTION_TYPES.INCOME : TRANSACTION_TYPES.EXPENSE,
    accountId: form.accountId,
    amount: Number(form.amount) || 0,
    category: form.category,
    note,
    createdAt: Date.now()
  }
}

export function addTemplate(form) {
  const template = normalizeTemplate(form)
  saveTemplates([...loadTemplates(), template])
  return template
}

export function updateTemplate(id, form) {
  saveTemplates(
    loadTemplates().map((t) => (t.id === id ? { ...normalizeTemplate(form), id, createdAt: t.createdAt } : t))
  )
}

export function updateTemplateAccount(id, accountId) {
  saveTemplates(loadTemplates().map((t) => (t.id === id ? { ...t, accountId } : t)))
}

export function removeTemplate(id, confirmFn = window.confirm) {
  if (!confirmFn('确认删除这个快捷模板吗？')) return false
  saveTemplates(loadTemplates().filter((t) => t.id !== id))
  return true
}

export function countTemplatesUsing(accountId) {
  return loadTemplates().filter((t) => t.accountId === accountId).length
}

// 由模板生成记账表单；overrides 仅在本次记账生效，不写回模板
export function templateToTransactionForm(template, overrides = {}) {
  const amount = Number(overrides.amount ?? template.amount) || 0
  return {
    type: template.type,
    accountId: overrides.accountId ?? template.accountId,
    toAccountId: '',
    amount,
    category: template.category,
    date: overrides.date || todayStr(),
    note: overrides.note ?? template.note,
    isLarge: template.type === TRANSACTION_TYPES.EXPENSE && amount >= 1000
  }
}
