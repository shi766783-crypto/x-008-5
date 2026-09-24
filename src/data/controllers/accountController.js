import { storage } from '../../core/storage.js'
import { uid } from '../../core/utils.js'
import { STORAGE_KEYS, ACCOUNT_TYPES } from '../../core/constants.js'
import { countTemplatesUsing } from './templateController.js'

export const emptyAccountForm = () => ({
  name: '',
  type: ACCOUNT_TYPES[0].value,
  initialBalance: ''
})

export function loadAccounts() {
  return storage.getJSON(STORAGE_KEYS.accounts) || []
}

export function saveAccounts(accounts) {
  storage.setJSON(STORAGE_KEYS.accounts, accounts)
}

export function normalizeAccount(form) {
  return {
    id: uid(),
    name: String(form.name || '').trim(),
    type: form.type,
    initialBalance: Number(form.initialBalance) || 0
  }
}

export function addAccount(form) {
  const account = normalizeAccount(form)
  saveAccounts([...loadAccounts(), account])
  return account
}

export function updateAccount(id, form) {
  const accounts = loadAccounts().map((a) =>
    a.id === id ? { ...a, name: String(form.name || '').trim(), type: form.type } : a
  )
  saveAccounts(accounts)
}

export function removeAccount(id, confirmFn = window.confirm) {
  const account = loadAccounts().find((a) => a.id === id)
  const tplCount = countTemplatesUsing(id)
  const tplTip = tplCount > 0 ? `\n有 ${tplCount} 个快捷模板引用了该账户，删除后使用时需重新指定账户。` : ''
  if (!confirmFn(`确认删除账户「${account?.name || id}」吗？相关历史记录将被保留。${tplTip}`)) return false
  saveAccounts(loadAccounts().filter((a) => a.id !== id))
  return true
}
