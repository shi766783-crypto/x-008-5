<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>记账</h2>
        <p class="page-sub">收入、支出与转账，一目了然</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">＋ 记一笔</button>
    </div>

    <div class="card tpl-card">
      <div class="tpl-head">
        <h3 class="tpl-title">快捷模板</h3>
        <button class="link-btn" @click="openTemplateCreate">＋ 新建模板</button>
      </div>
      <div class="tpl-list" v-if="store.templates.length">
        <div
          v-for="tpl in store.templates"
          :key="tpl.id"
          class="tpl-chip"
          :class="{ broken: isTplBroken(tpl) }"
          title="点击生成一笔流水"
          @click="openApply(tpl)"
        >
          <div class="tpl-chip-top">
            <span class="tpl-name">{{ tpl.name }}</span>
            <span class="tpl-actions" @click.stop>
              <button class="icon-btn" @click="openTemplateEdit(tpl)" title="编辑模板">✎</button>
              <button class="icon-btn" @click="removeTemplate(tpl)" title="删除模板">✕</button>
            </span>
          </div>
          <div class="tpl-meta">
            <span v-if="isTplBroken(tpl)" class="badge danger">账户已删除</span>
            <template v-else>{{ tpl.category }} · {{ accountName(tpl.accountId) }}</template>
          </div>
          <div class="tpl-amount" :class="tpl.type">
            {{ tpl.type === 'income' ? '+' : '-' }}¥{{ money(tpl.amount) }}
          </div>
        </div>
      </div>
      <div v-else class="empty-row">还没有快捷模板。把早餐、地铁、房租等固定收支存成模板，之后点一下即可记账。</div>
    </div>

    <div class="filters card">
      <input v-model="filters.keyword" class="filter-input" placeholder="搜索备注 / 类别" />
      <select v-model="filters.type" class="filter-select">
        <option value="">全部类型</option>
        <option v-for="(label, key) in TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
      <select v-model="filters.category" class="filter-select">
        <option value="">全部类别</option>
        <optgroup v-if="filters.type !== 'transfer'" label="收入">
          <option v-for="c in INCOME_CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </optgroup>
        <optgroup v-if="filters.type !== 'income'" label="支出">
          <option v-for="c in EXPENSE_CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </optgroup>
      </select>
      <label class="check">
        <input type="checkbox" v-model="filters.largeOnly" />
        仅看大额
      </label>
    </div>

    <div class="card list-card">
      <h3 class="list-title">记账记录</h3>
      <div class="tx-list">
        <div v-for="t in visibleTransactions" :key="t.id" class="tx-item">
          <div class="tx-icon" :class="t.type">$</div>
          <div class="tx-main">
            <div class="tx-title">
              <span>{{ renderTitle(t) }}</span>
              <span v-if="t.isLarge" class="badge badge-large">大额</span>
            </div>
            <div class="tx-meta">{{ renderMeta(t) }}</div>
          </div>
          <div class="tx-amount" :class="t.type">
            {{ t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '' }}¥{{ money(t.amount) }}
          </div>
          <button class="icon-btn" @click="remove(t)" title="删除">✕</button>
        </div>
        <div v-if="visibleTransactions.length === 0" class="empty-row">暂无记录</div>
      </div>
    </div>

    <Modal :title="editing ? '编辑记录' : '记一笔'" @close="modalOpen = false" v-if="modalOpen">
      <form id="tx-form" @submit.prevent="submit" class="form">
        <div class="seg type-seg">
          <button type="button" class="seg-btn wide" :class="{ active: form.type === 'income' }" @click="switchType('income')">收入</button>
          <button type="button" class="seg-btn wide" :class="{ active: form.type === 'expense' }" @click="switchType('expense')">支出</button>
          <button type="button" class="seg-btn wide" :class="{ active: form.type === 'transfer' }" @click="switchType('transfer')">转账</button>
        </div>

        <label class="field">
          <span>{{ form.type === 'transfer' ? '转出账户' : '账户' }}</span>
          <select v-model="form.accountId" required>
            <option value="" disabled>选择账户</option>
            <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>

        <label class="field" v-if="form.type === 'transfer'">
          <span>转入账户</span>
          <select v-model="form.toAccountId" required>
            <option value="" disabled>选择转入账户</option>
            <option v-for="a in otherAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>

        <label class="field">
          <span>金额</span>
          <input v-model.number="form.amount" type="number" min="0.01" step="0.01" required placeholder="0.00" />
        </label>

        <label class="field" v-if="form.type !== 'transfer'">
          <span>类别</span>
          <select v-model="form.category">
            <option v-for="c in currentCategories" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>

        <label class="field">
          <span>日期</span>
          <input v-model="form.date" type="date" required />
        </label>

        <label class="field">
          <span>备注</span>
          <input v-model="form.note" placeholder="选填" />
        </label>

        <label class="check field-check">
          <input type="checkbox" v-model="form.isLarge" />
          大额支出（单笔 ≥ 1000 元）
        </label>

        <template v-if="form.type !== 'transfer'">
          <label class="check field-check">
            <input type="checkbox" v-model="saveAsTemplate" />
            同时保存为快捷模板
          </label>
          <label class="field" v-if="saveAsTemplate">
            <span>模板名称</span>
            <input v-model="templateName" placeholder="留空则按备注 / 类别命名" />
          </label>
        </template>

      </form>

        <template #footer>
          <button type="button" class="btn" @click="modalOpen = false">取消</button>
          <button type="submit" class="btn btn-primary" form="tx-form">保存</button>
        </template>
    </Modal>

    <Modal :title="applyTarget ? `模板记账：${applyTarget.name}` : ''" @close="applyOpen = false" v-if="applyOpen">
      <form id="tpl-apply-form" @submit.prevent="submitApply" class="form">
        <div v-if="applyBroken" class="apply-warn">
          模板引用的账户已被删除，请重新指定账户；确认后模板将关联到新账户。
        </div>

        <label class="field">
          <span>账户</span>
          <select v-model="applyForm.accountId" required>
            <option value="" disabled>选择账户</option>
            <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>

        <label class="field">
          <span>金额（仅本次生效，不修改模板）</span>
          <input v-model.number="applyForm.amount" type="number" min="0.01" step="0.01" required placeholder="0.00" />
        </label>

        <label class="field">
          <span>日期</span>
          <input v-model="applyForm.date" type="date" required />
        </label>

        <label class="field">
          <span>备注</span>
          <input v-model="applyForm.note" placeholder="选填" />
        </label>
      </form>

        <template #footer>
          <button type="button" class="btn" @click="applyOpen = false">取消</button>
          <button type="submit" class="btn btn-primary" form="tpl-apply-form">确认记账</button>
        </template>
    </Modal>

    <Modal :title="editingTemplate ? '编辑模板' : '新建模板'" @close="tplModalOpen = false" v-if="tplModalOpen">
      <form id="tpl-form" @submit.prevent="submitTemplate" class="form">
        <label class="field">
          <span>模板名称</span>
          <input v-model="tplForm.name" placeholder="如：早餐、地铁通勤" />
        </label>

        <div class="seg type-seg">
          <button type="button" class="seg-btn wide" :class="{ active: tplForm.type === 'expense' }" @click="switchTplType('expense')">支出</button>
          <button type="button" class="seg-btn wide" :class="{ active: tplForm.type === 'income' }" @click="switchTplType('income')">收入</button>
        </div>

        <label class="field">
          <span>账户</span>
          <select v-model="tplForm.accountId" required>
            <option value="" disabled>选择账户</option>
            <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </label>

        <label class="field">
          <span>金额</span>
          <input v-model.number="tplForm.amount" type="number" min="0.01" step="0.01" required placeholder="0.00" />
        </label>

        <label class="field">
          <span>类别</span>
          <select v-model="tplForm.category">
            <option v-for="c in tplCategories" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>

        <label class="field">
          <span>备注</span>
          <input v-model="tplForm.note" placeholder="选填" />
        </label>
      </form>

        <template #footer>
          <button type="button" class="btn" @click="tplModalOpen = false">取消</button>
          <button type="submit" class="btn btn-primary" form="tpl-form">保存模板</button>
        </template>
    </Modal>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { useStore, refreshKeys, controllersApi } from '../data/store.js'
import { money, todayStr } from '../core/utils.js'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, TRANSACTION_TYPES } from '../core/constants.js'
import Modal from '../components/Modal.vue'

const store = useStore()
const { transaction: txApi, template: tplApi } = controllersApi

const TYPE_LABELS = { income: '收入', expense: '支出', transfer: '转账' }

const modalOpen = ref(false)
const editing = ref(null)
const form = reactive(txApi.emptyTransactionForm())
const filters = reactive({ keyword: '', type: '', category: '', largeOnly: false })
const saveAsTemplate = ref(false)
const templateName = ref('')

const tplModalOpen = ref(false)
const editingTemplate = ref(null)
const tplForm = reactive(tplApi.emptyTemplateForm())

const applyOpen = ref(false)
const applyTarget = ref(null)
const applyBroken = ref(false)
const applyForm = reactive({ accountId: '', amount: '', date: '', note: '' })

const switchType = (type) => {
  form.type = type
  form.category = type === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]
  form.toAccountId = ''
}

const currentCategories = computed(() => (form.type === TRANSACTION_TYPES.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES))
const otherAccounts = computed(() => store.accounts.filter((a) => a.id !== form.accountId))
const tplCategories = computed(() => (tplForm.type === TRANSACTION_TYPES.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES))

const visibleTransactions = computed(() => {
  let list = [...store.transactions]
  if (filters.type) list = list.filter((t) => t.type === filters.type)
  if (filters.category) list = list.filter((t) => t.category === filters.category)
  if (filters.largeOnly) list = list.filter((t) => t.isLarge)
  if (filters.keyword) {
    const k = filters.keyword.trim().toLowerCase()
    list = list.filter((t) => (t.note || '').toLowerCase().includes(k) || (t.category || '').toLowerCase().includes(k))
  }
  list.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
  return list
})

const accountName = (id) => store.accounts.find((a) => a.id === id)?.name || '未知账户'

const renderTitle = (t) => {
  if (t.type === 'transfer') return `${accountName(t.fromAccountId)} → ${accountName(t.toAccountId)}`
  return t.category || (t.type === 'income' ? '收入' : '支出')
}
const renderMeta = (t) => {
  const parts = [t.date]
  if (t.type === 'transfer') parts.unshift('转账')
  else parts.unshift(accountName(t.accountId), t.type === 'income' ? '收入' : '支出')
  if (t.note) parts.push(t.note)
  return parts.join(' · ')
}

const openCreate = () => {
  editing.value = null
  saveAsTemplate.value = false
  templateName.value = ''
  Object.assign(form, txApi.emptyTransactionForm(), { accountId: store.accounts[0]?.id || '', toAccountId: store.accounts[1]?.id || '', date: todayStr() })
  modalOpen.value = true
}

const submit = () => {
  if (!form.accountId || !form.amount) return
  if (form.type === 'transfer' && form.accountId === form.toAccountId) {
    alert('转账账户不能相同')
    return
  }
  txApi.addTransaction(form)
  if (saveAsTemplate.value && form.type !== TRANSACTION_TYPES.TRANSFER) {
    tplApi.addTemplate({
      name: templateName.value,
      type: form.type,
      accountId: form.accountId,
      amount: form.amount,
      category: form.category,
      note: form.note
    })
    refreshKeys('templates')
  }
  refreshKeys('transactions', 'accounts')
  modalOpen.value = false
  controllersApi.achievement.updateAchievements()
  refreshKeys('achievements', 'points')
}

const remove = (t) => {
  if (txApi.removeTransaction(t.id)) {
    refreshKeys('transactions', 'accounts')
    controllersApi.achievement.updateAchievements()
    refreshKeys('achievements', 'points')
  }
}

const isTplBroken = (tpl) => !store.accounts.some((a) => a.id === tpl.accountId)

const switchTplType = (type) => {
  tplForm.type = type
  tplForm.category = type === TRANSACTION_TYPES.INCOME ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]
}

const openTemplateCreate = () => {
  editingTemplate.value = null
  Object.assign(tplForm, tplApi.emptyTemplateForm(), { accountId: store.accounts[0]?.id || '' })
  tplModalOpen.value = true
}

const openTemplateEdit = (tpl) => {
  editingTemplate.value = tpl
  Object.assign(tplForm, {
    name: tpl.name,
    type: tpl.type,
    accountId: isTplBroken(tpl) ? store.accounts[0]?.id || '' : tpl.accountId,
    amount: tpl.amount,
    category: tpl.category,
    note: tpl.note
  })
  tplModalOpen.value = true
}

const submitTemplate = () => {
  if (!tplForm.accountId || !tplForm.amount) return
  if (editingTemplate.value) tplApi.updateTemplate(editingTemplate.value.id, tplForm)
  else tplApi.addTemplate(tplForm)
  refreshKeys('templates')
  tplModalOpen.value = false
}

const removeTemplate = (tpl) => {
  if (tplApi.removeTemplate(tpl.id)) refreshKeys('templates')
}

const openApply = (tpl) => {
  applyTarget.value = tpl
  applyBroken.value = isTplBroken(tpl)
  Object.assign(applyForm, {
    accountId: applyBroken.value ? '' : tpl.accountId,
    amount: tpl.amount,
    date: todayStr(),
    note: tpl.note
  })
  applyOpen.value = true
}

const submitApply = () => {
  const tpl = applyTarget.value
  if (!tpl || !applyForm.accountId || !applyForm.amount) return
  txApi.addTransaction(tplApi.templateToTransactionForm(tpl, { ...applyForm }))
  // 原账户已被删除：确认后把模板重新指定到新账户
  if (applyBroken.value) {
    tplApi.updateTemplateAccount(tpl.id, applyForm.accountId)
    refreshKeys('templates')
  }
  refreshKeys('transactions', 'accounts')
  applyOpen.value = false
  controllersApi.achievement.updateAchievements()
  refreshKeys('achievements', 'points')
}
</script>

<style scoped>
.tpl-card {
  margin-bottom: 16px;
}
.tpl-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.tpl-title {
  margin: 0;
  font-size: 15px;
}
.tpl-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}
.tpl-chip {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 10px 12px;
  background: var(--bg-elevated);
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
}
.tpl-chip:hover {
  border-color: var(--accent);
}
.tpl-chip:active {
  transform: scale(0.98);
}
.tpl-chip.broken {
  border-color: var(--expense);
}
.tpl-chip-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 6px;
}
.tpl-name {
  font-weight: 700;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tpl-actions {
  display: flex;
  flex-shrink: 0;
}
.tpl-actions .icon-btn {
  font-size: 12px;
  padding: 2px 5px;
}
.tpl-meta {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}
.tpl-amount {
  font-weight: 800;
  margin-top: 6px;
}
.tpl-amount.income { color: var(--income); }
.tpl-amount.expense { color: var(--expense); }
.apply-warn {
  background: rgba(224, 82, 96, 0.08);
  color: var(--expense);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  margin-bottom: 14px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
}
.filter-input,
.filter-select {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 13px;
}
.filter-input {
  flex: 1;
  min-width: 160px;
}
.check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}
.list-card {
  padding-bottom: 8px;
}
.list-title {
  margin: 0 0 6px;
  font-size: 15px;
}
.tx-list {
  display: flex;
  flex-direction: column;
}
.tx-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 4px;
  border-bottom: 1px solid var(--border-color);
}
.tx-item:last-child {
  border-bottom: none;
}
.tx-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}
.tx-icon.income { background: var(--income); }
.tx-icon.expense { background: var(--expense); }
.tx-icon.transfer { background: var(--accent); }
.tx-main {
  flex: 1;
  min-width: 0;
}
.tx-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}
.tx-meta {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tx-amount {
  font-weight: 800;
  white-space: nowrap;
}
.tx-amount.income { color: var(--income); }
.tx-amount.expense { color: var(--expense); }
.tx-amount.transfer { color: var(--accent); }
.type-seg {
  margin-bottom: 4px;
}
.field-check {
  margin-top: 6px;
}
.empty-row {
  text-align: center;
  color: var(--text-secondary);
  padding: 24px 0;
  font-size: 13px;
}
</style>
