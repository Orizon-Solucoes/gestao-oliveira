
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type KeyboardEvent } from 'react'
import type { Product, Sale, StoreData, Payment, CashSession } from '../electron/store'
import './App.css'
import logoGestao from './assets/gestao-oliveira.svg'

type Page = 'Início' | 'Frente de caixa' | 'Produtos' | 'Vendas' | 'Relatórios' | 'Caixa'
type CartItem = { key: string; productId: string | null; name: string; quantity: number; unitPrice: number }

const pages: { name: Page; icon: string }[] = [
  { name: 'Início', icon: '⌂' },
  { name: 'Frente de caixa', icon: '▣' },
  { name: 'Produtos', icon: '▤' },
  { name: 'Vendas', icon: '↗' },
  { name: 'Relatórios', icon: '▥' },
  { name: 'Caixa', icon: '◷' },
]

const paymentMethods: Payment['method'][] = ['Dinheiro', 'Pix', 'Débito', 'Crédito']
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const dateTime = (v: string) => new Date(v).toLocaleString('pt-BR')

const blankData: StoreData = {
  version: 1,
  products: [],
  sales: [],
  cashSession: null,
  cashSessions: [],
  nextSaleNumber: 1,
}

function salesForCashSession(data: StoreData, session: CashSession): Sale[] {
  return data.sales.filter(sale => sale.cashSessionId
    ? sale.cashSessionId === session.id
    : sale.createdAt >= session.openedAt && (!session.closedAt || sale.createdAt <= session.closedAt))
}

function App() {
  const [page, setPage] = useState<Page>('Início')
  const [data, setData] = useState<StoreData>(blankData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCartKey, setSelectedCartKey] = useState<string | null>(null)
  const [cartQuantityItem, setCartQuantityItem] = useState<CartItem | null>(null)
  const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month')

  const searchInputRef = useRef<HTMLInputElement>(null)
  const quantityInputRef = useRef<HTMLInputElement>(null)
  const openingAmountRef = useRef<HTMLInputElement>(null)
  const receiptCustomerNameRef = useRef<HTMLInputElement>(null)

  const [productModal, setProductModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [checkout, setCheckout] = useState(false)
  const [checkoutPayments, setCheckoutPayments] = useState<Payment[]>([])
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null)
  const [printQuestionSale, setPrintQuestionSale] = useState<Sale | null>(null)
  const [expandedCashSessionId, setExpandedCashSessionId] = useState<string | null>(null)
  const [salesCashSessionFilter, setSalesCashSessionFilter] = useState('')

  const [receiptIsFiado, setReceiptIsFiado] = useState(false)
  const [receiptCopies, setReceiptCopies] = useState<'loja' | 'loja-cliente'>('loja')

  const [diversosModal, setDiversosModal] = useState(false)
  const [diversosDescription, setDiversosDescription] = useState('')
  const [diversosPrice, setDiversosPrice] = useState('')

  const [quantityModalProduct, setQuantityModalProduct] = useState<Product | null>(null)
  const [quantityInput, setQuantityInput] = useState('1')

  const [productForm, setProductForm] = useState({
    name: '',
    category: 'Geral',
    costPrice: '',
    salePrice: '',
    stock: '0',
    unit: 'un',
  })

  const refresh = useCallback(async () => {
    try {
      setData(await window.loja.getState())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar os dados locais.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (quantityModalProduct) {
      quantityInputRef.current?.focus()
      quantityInputRef.current?.select()
    }
  }, [quantityModalProduct])

  const activeProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return data.products
      .filter(product => product.active)
      .filter(product => !query || (product.name + ' ' + product.category).toLowerCase().includes(query))
  }, [data.products, search])

  const total = useMemo(
    () => roundMoney(cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)),
    [cart],
  )

  const paymentTotal = roundMoney(
    checkoutPayments.reduce((sum, payment) => sum + payment.amount, 0),
  )
  const paymentRemaining = roundMoney(total - paymentTotal)
  const paymentValid = checkoutPayments.length > 0
    && checkoutPayments.every(payment => Number.isFinite(payment.amount) && payment.amount > 0)
    && Math.abs(paymentRemaining) < 0.01

  const todaySales = data.sales.filter(sale =>
    sale.status === 'concluida'
    && new Date(sale.createdAt).toDateString() === new Date().toDateString(),
  )
  const todayTotal = todaySales.reduce((sum, sale) => sum + sale.total, 0)

  const activeCashSales = data.cashSession && !data.cashSession.closedAt
    ? salesForCashSession(data, data.cashSession).filter(sale => sale.status === 'concluida')
    : []

  const activeCashProfit = activeCashSales.reduce((sum, sale) =>
    sum + sale.items.reduce((itemsSum, item) =>
      itemsSum + (item.costPrice === null ? 0 : (item.unitPrice - item.costPrice) * item.quantity), 0),
  0)

  const orderedCashSessions = [...data.cashSessions].sort((a, b) =>
    b.openedAt.localeCompare(a.openedAt),
  )

  const defaultSalesCashSessionId = data.cashSession && !data.cashSession.closedAt
    ? data.cashSession.id
    : orderedCashSessions[0]?.id || 'all'

  const selectedSalesCashSessionId = salesCashSessionFilter || defaultSalesCashSessionId
  const selectedSalesSession = data.cashSessions.find(
    session => session.id === selectedSalesCashSessionId,
  )

  const displayedSales = selectedSalesCashSessionId === 'all'
    ? data.sales
    : selectedSalesSession
      ? salesForCashSession(data, selectedSalesSession)
      : data.sales

  const lowStock = data.products.filter(product => product.active && product.stock <= 5)
  const cashIsOpen = Boolean(data.cashSession && !data.cashSession.closedAt)

  const reportSales = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (reportPeriod === 'week') {
      const day = (start.getDay() + 6) % 7
      start.setDate(start.getDate() - day)
    } else if (reportPeriod === 'month') {
      start.setDate(1)
    }
    return data.sales.filter(sale => {
      if (sale.status !== 'concluida') return false
      if (reportPeriod === 'all') return true
      return new Date(sale.createdAt) >= start
    })
  }, [data.sales, reportPeriod])

  const reportTotal = reportSales.reduce((sum, sale) => sum + sale.total, 0)
  const reportPaymentTotals = paymentMethods.reduce((totals, method) => {
    totals[method] = reportSales.flatMap(sale => sale.payments)
      .filter(payment => payment.method === method)
      .reduce((sum, payment) => sum + payment.amount, 0)
    return totals
  }, {} as Record<Payment['method'], number>)

  const productSales = data.products.map(product => ({
    id: product.id,
    name: product.name,
    unit: product.unit,
    quantity: reportSales.reduce((sum, sale) => sum + sale.items
      .filter(item => item.productId === product.id)
      .reduce((itemSum, item) => itemSum + item.quantity, 0), 0),
  }))
  const bestSellingProducts = productSales
    .filter(product => product.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name))
    .slice(0, 10)
  const leastSellingProducts = productSales
    .sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name))
    .slice(0, 10)

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action()
      await refresh()
      setNotice(success)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocorreu um erro.')
      setNotice('')
    }
  }

  const finalize = useCallback(() => {
    if (!cart.length) {
      setError('Adicione produtos antes de receber o pagamento.')
      return
    }
    if (!cashIsOpen) {
      setError('Abra o caixa antes de registrar uma venda.')
      return
    }

    setCheckoutPayments([{ method: 'Dinheiro', amount: total }])
    setCheckout(true)
    setError('')
    setNotice('')
  }, [cart.length, cashIsOpen, total])

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (page !== 'Frente de caixa') return

      if (event.key === 'Escape') {
        event.preventDefault()
        if (quantityModalProduct) setQuantityModalProduct(null)
        else if (cartQuantityItem) setCartQuantityItem(null)
        else if (checkout) setCheckout(false)
        else if (diversosModal) setDiversosModal(false)
        else if (productModal) setProductModal(false)
        else if (receiptSale) setReceiptSale(null)
        else if (printQuestionSale) setPrintQuestionSale(null)
        else if (cart.length && window.confirm('Cancelar a venda atual e limpar todos os itens do carrinho?')) {
          setCart([])
          setSelectedCartKey(null)
          setError('')
          setNotice('Venda atual cancelada.')
        }
        return
      }

      const modalOpen = checkout || diversosModal || productModal || receiptSale || printQuestionSale || quantityModalProduct || cartQuantityItem

      if (event.key === 'F2' && !modalOpen) {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }

      if (event.key === 'F3' && !modalOpen && cart.length) {
        event.preventDefault()
        const selected = cart.find(item => item.key === selectedCartKey) || cart[cart.length - 1]
        openCartQuantityEditor(selected)
      }

      if (event.key === 'F4' && !modalOpen) {
        event.preventDefault()
        finalize()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [page, checkout, diversosModal, productModal, receiptSale, printQuestionSale, quantityModalProduct, cartQuantityItem, cart, selectedCartKey, finalize])

  const openNewProduct = (product?: Product) => {
    setEditing(product || null)
    setProductForm(product ? {
      name: product.name,
      category: product.category,
      costPrice: product.costPrice === null ? '' : String(product.costPrice),
      salePrice: String(product.salePrice),
      stock: String(product.stock),
      unit: product.unit,
    } : {
      name: '',
      category: 'Geral',
      costPrice: '',
      salePrice: '',
      stock: '0',
      unit: 'un',
    })
    setProductModal(true)
  }

  const saveProduct = async (event: FormEvent) => {
    event.preventDefault()
    await run(() => window.loja.saveProduct({
      id: editing?.id,
      name: productForm.name,
      category: productForm.category,
      costPrice: productForm.costPrice.trim() === '' ? null : Number(productForm.costPrice),
      salePrice: Number(productForm.salePrice),
      stock: Number(productForm.stock),
      unit: productForm.unit,
    }), editing ? 'Produto atualizado.' : 'Produto cadastrado.')
    setProductModal(false)
  }

  const openQuantityModal = (product: Product) => {
    setCartQuantityItem(null)
    setQuantityModalProduct(product)
    setQuantityInput('1')
    setError('')
    setNotice('')
  }

  const openCartQuantityEditor = (item: CartItem) => {
    setQuantityModalProduct(null)
    setCartQuantityItem(item)
    setQuantityInput(String(item.quantity))
    setError('')
    setNotice('')
  }

  const confirmAddProduct = (event?: FormEvent) => {
    event?.preventDefault()
    const quantity = Number(quantityInput)

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Informe uma quantidade inteira válida, maior que zero.')
      return
    }

    if (cartQuantityItem) {
      setCart(current => current.map(item => item.key === cartQuantityItem.key
        ? { ...item, quantity }
        : item))
      setSelectedCartKey(cartQuantityItem.key)
      setCartQuantityItem(null)
      setQuantityInput('1')
      setError('')
      setNotice('Quantidade de ' + cartQuantityItem.name + ' atualizada para ' + quantity + '.')
      return
    }

    if (!quantityModalProduct) return
    const product = quantityModalProduct

    setCart(current => {
      const found = current.find(item => item.productId === product.id)

      if (found) {
        return current.map(item => item.key === found.key
          ? { ...item, quantity: item.quantity + quantity }
          : item)
      }

      return [...current, {
        key: product.id,
        productId: product.id,
        name: product.name,
        quantity,
        unitPrice: product.salePrice,
      }]
    })

    setQuantityModalProduct(null)
    setCartQuantityItem(null)
    setSelectedCartKey(product.id)
    setQuantityInput('1')
    setError('')
    setNotice(quantity + 'x ' + product.name + ' adicionado à venda.')
    setSearch('')
    searchInputRef.current?.focus()
  }

  const handleProductSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()

    const query = search.trim().toLowerCase()
    if (!query) return

    const exactMatch = activeProducts.find(product => product.name.toLowerCase() === query)
    const product = exactMatch || (activeProducts.length === 1 ? activeProducts[0] : null)

    if (product) {
      openQuantityModal(product)
    } else {
      setError(activeProducts.length ? 'Mais de um produto encontrado. Refine a pesquisa.' : 'Nenhum produto encontrado.')
    }
  }

  const addDiversos = () => {
    setDiversosDescription('')
    setDiversosPrice('')
    setDiversosModal(true)
  }

  const confirmDiversos = (event: FormEvent) => {
    event.preventDefault()
    const description = diversosDescription.trim()
    const value = Number(diversosPrice.replace(',', '.'))

    if (!description) {
      setError('Informe a descrição do item Diversos.')
      return
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError('Informe um valor válido para Diversos.')
      return
    }

    setCart(items => [...items, {
      key: crypto.randomUUID(),
      productId: null,
      name: 'Diversos — ' + description,
      quantity: 1,
      unitPrice: roundMoney(value),
    }])
    setDiversosModal(false)
    setError('')
    setNotice('Item Diversos adicionado à venda.')
  }

  const addPaymentLine = () => {
    if (paymentRemaining <= 0) return
    const unusedMethod = paymentMethods.find(
      method => !checkoutPayments.some(payment => payment.method === method),
    )
    if (!unusedMethod) return

    setCheckoutPayments(rows => [...rows, {
      method: unusedMethod,
      amount: paymentRemaining,
    }])
  }

  const openReceiptOptions = (sale: Sale) => {
    setReceiptSale(sale)
    setReceiptIsFiado(false)
    setReceiptCopies('loja')
  }

  const confirmReceiptPrint = async (event: FormEvent) => {
    event.preventDefault()
    if (!receiptSale) return

    try {
      const result = await window.loja.printReceipt(receiptSale, {
        customerName: receiptCustomerNameRef.current?.value.trim() || 'Não informado',
        isFiado: receiptIsFiado,
        copies: receiptCopies,
      })

      if (result.success) {
        setNotice('Comprovante da venda #' + receiptSale.number + ' enviado para impressão.')
        setError('')
        setReceiptSale(null)
      } else {
        setError('Não foi possível imprimir: ' + (result.error || 'verifique a impressora.'))
        setNotice('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível imprimir o comprovante.')
      setNotice('')
    }
  }

  const confirmSale = async () => {
    if (!paymentValid) {
      setError('Confira os valores: os pagamentos precisam somar exatamente o total da venda.')
      return
    }

    try {
      const sale = await window.loja.finalizeSale({
        items: cart.map(item => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        payments: checkoutPayments,
      })

      setCart([])
      setSelectedCartKey(null)
      setCheckout(false)
      setCheckoutPayments([])
      // Não altera a página: permanece na Frente de caixa após a venda.
      setNotice('Venda registrada com sucesso.')
      setError('')
      await refresh()
      setPrintQuestionSale(sale)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível registrar a venda.')
      setNotice('')
    }
  }

  const printSale = (sale: Sale) => openReceiptOptions(sale)

  const cancelSale = async (sale: Sale) => {
    if (sale.status === 'cancelada' || !window.confirm(
      'Cancelar a venda #' + sale.number + '? O estoque dos produtos será restaurado.',
    )) return
    await run(() => window.loja.cancelSale(sale.id), 'Venda cancelada e estoque restaurado.')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src={logoGestao} alt="Gestão Oliveira" />
          <div>
            <strong>Gestão Oliveira</strong>
            <span>GESTÃO COMERCIAL</span>
          </div>
        </div>

        <div className="nav-label">MENU PRINCIPAL</div>
        <nav>
          {pages.map(item => (
            <button
              key={item.name}
              className={page === item.name ? 'nav-item active' : 'nav-item'}
              onClick={() => {
                setPage(item.name)
                setError('')
                setNotice('')
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className={cashIsOpen ? 'status-dot' : 'status-dot closed'} />
          {cashIsOpen ? 'Caixa aberto' : 'Caixa fechado'}
          <small>· Dados neste computador</small>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Gestão Oliveira <span>/</span> {page}</div>
          <span className="user-chip">● Operação local</span>
        </header>

        <section className="page-content">
          {(error || notice) && (
            <div className={error ? 'alert error' : 'alert success'} role="status">
              {error || notice}
              <button onClick={() => { setError(''); setNotice('') }}>×</button>
            </div>
          )}

          {loading ? (
            <div className="panel empty">Carregando dados locais...</div>
          ) : (
            <>
              {page === 'Início' && (
                <>
                  <Heading
                    title="Visão geral"
                    subtitle="Resumo real da loja."
                    action={
                      <button className="button-primary" onClick={() => setPage('Frente de caixa')}>
                        ＋ Nova venda
                      </button>
                    }
                  />

                  <div className="stats-grid">
                    <Stat label="Faturamento de hoje" value={money(todayTotal)} note="Vendas concluídas" />
                    <Stat label="Vendas hoje" value={String(todaySales.length)} note="Sem contar cancelamentos" />
                    <Stat label="Produtos ativos" value={String(data.products.filter(p => p.active).length)} note="Cadastrados no sistema" />
                    <Stat label="Estoque baixo" value={String(lowStock.length)} note="5 unidades ou menos" />
                  </div>

                  <div className="content-grid">
                    <section className="panel">
                      <PanelTitle title="Acesso rápido" />
                      <Shortcut title="Registrar venda" text="Abrir frente de caixa" onClick={() => setPage('Frente de caixa')} />
                      <Shortcut title="Cadastrar produto" text="Adicionar ao estoque" onClick={() => { openNewProduct(); setPage('Produtos') }} />
                      <Shortcut title="Consultar vendas" text="Histórico e cancelamentos" onClick={() => setPage('Vendas')} />
                    </section>

                    <section className="panel">
                      <PanelTitle title="Estoque baixo" />
                      <p className="muted">Produtos com 5 unidades ou menos.</p>
                      {lowStock.length ? lowStock.slice(0, 6).map(product => (
                        <div className="simple-row" key={product.id}>
                          <span>{product.name}</span>
                          <strong>{product.stock} {product.unit}</strong>
                        </div>
                      )) : <div className="empty compact">Nenhum alerta de estoque.</div>}
                    </section>
                  </div>
                </>
              )}

              {page === 'Produtos' && (
                <>
                  <Heading
                    title="Produtos e estoque"
                    subtitle="Cadastre e atualize os produtos da loja."
                    action={<button className="button-primary" onClick={() => openNewProduct()}>＋ Novo produto</button>}
                  />

                  <input
                    className="search-input"
                    placeholder="Buscar por nome ou categoria..."
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                  />

                  <div className="panel table-panel">
                    <table>
                      <thead>
                        <tr>
                          <th>PRODUTO</th>
                          <th>CATEGORIA</th>
                          <th>ESTOQUE</th>
                          <th>CUSTO</th>
                          <th>VENDA</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeProducts.map(product => (
                          <tr key={product.id}>
                            <td><strong>{product.name}</strong></td>
                            <td>{product.category}</td>
                            <td>
                              <span className={product.stock <= 5 ? 'stock-low' : ''}>
                                {product.stock} {product.unit}
                              </span>
                            </td>
                            <td>{product.costPrice === null ? '—' : money(product.costPrice)}</td>
                            <td>{money(product.salePrice)}</td>
                            <td className="row-actions">
                              <button onClick={() => openNewProduct(product)}>Editar</button>
                              <button onClick={() => {
                                if (window.confirm('Remover ou arquivar ' + product.name + '?')) {
                                  void run(() => window.loja.deleteProduct(product.id), 'Produto removido/arquivado.')
                                }
                              }}>Remover</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {activeProducts.length === 0 && (
                      <div className="empty">Nenhum produto cadastrado. Clique em “Novo produto” para começar.</div>
                    )}
                  </div>
                </>
              )}

              {page === 'Frente de caixa' && (
                <>
                  <Heading
                    title="Frente de caixa"
                    subtitle={cashIsOpen ? 'Caixa aberto — venda pronta para registrar.' : 'Abra o caixa antes de registrar vendas.'}
                    action={!cashIsOpen ? (
                      <button className="button-primary" onClick={() => setPage('Caixa')}>Abrir caixa</button>
                    ) : undefined}
                  />

                  <div className="pos-layout">
                    <section className="panel">
                      <input
                        ref={searchInputRef}
                        className="search-input full"
                        placeholder="Buscar produto... (F2)"
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        onKeyDown={handleProductSearchKeyDown}
                      />

                      <div className="product-pick-grid">
                        {activeProducts.map(product => (
                          <button
                            className="product-pick"
                            key={product.id}
                            onClick={() => openQuantityModal(product)}
                          >
                            <strong>{product.name}</strong>
                            <span>{product.stock > 0 ? `${product.stock} ${product.unit} em estoque` : 'Sem estoque — venda permitida'}</span>
                            <b>{money(product.salePrice)}</b>
                          </button>
                        ))}
                      </div>

                      {activeProducts.length === 0 && (
                        <div className="empty compact">Nenhum produto encontrado.</div>
                      )}

                      <button className="button-secondary" onClick={addDiversos}>
                        ＋ Item Diversos (valor manual)
                      </button>

                      <p className="pos-shortcuts">
                        Atalhos: <strong>F2</strong> pesquisar · <strong>Enter</strong> selecionar · <strong>F3</strong> alterar quantidade · <strong>F4</strong> receber · <strong>Esc</strong> cancelar
                      </p>
                    </section>

                    <section className="panel cart-panel">
                      <PanelTitle title="Venda atual" />

                      <div className="cart-items">
                        {cart.map(item => (
                          <div
                            className={selectedCartKey === item.key ? 'cart-row selected' : 'cart-row'}
                            key={item.key}
                            onClick={() => setSelectedCartKey(item.key)}
                          >
                            <div>
                              <strong>{item.name}</strong>
                              <small>{money(item.unitPrice)} cada</small>
                            </div>

                            <div className="quantity-controls">
                              <button onClick={event => {
                                event.stopPropagation()
                                setCart(current => current.map(i =>
                                  i.key === item.key ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i,
                                ))
                                setSelectedCartKey(item.key)
                              }}>−</button>

                              <button
                                type="button"
                                title="Alterar quantidade (F3)"
                                aria-label={'Alterar quantidade de ' + item.name}
                                onClick={event => {
                                  event.stopPropagation()
                                  openCartQuantityEditor(item)
                                }}
                              >{item.quantity}</button>

                              <button onClick={event => {
                                event.stopPropagation()
                                setCart(current => current.map(i =>
                                  i.key === item.key ? { ...i, quantity: i.quantity + 1 } : i,
                                ))
                                setSelectedCartKey(item.key)
                              }}>＋</button>

                              <button
                                className="remove"
                                onClick={event => {
                                  event.stopPropagation()
                                  setCart(current => current.filter(i => i.key !== item.key))
                                  if (selectedCartKey === item.key) setSelectedCartKey(null)
                                }}
                              >×</button>
                            </div>

                            <strong>{money(item.quantity * item.unitPrice)}</strong>
                          </div>
                        ))}

                        {cart.length === 0 && (
                          <div className="empty compact">Selecione produtos para iniciar a venda.</div>
                        )}
                      </div>

                      <div className="cart-total">
                        <span>Total</span>
                        <strong>{money(total)}</strong>
                      </div>

                      <button
                        className="button-primary checkout-button"
                        disabled={!cart.length || !cashIsOpen}
                        onClick={finalize}
                      >
                        Receber pagamento (F4)
                      </button>
                    </section>
                  </div>
                </>
              )}

              {page === 'Vendas' && (
                <>
                  <Heading title="Histórico de vendas" subtitle="Consulte as vendas de cada caixa separadamente." />

                  <div className="panel sales-filter-panel">
                    <label className="field-label">
                      Mostrar vendas do caixa
                      <select
                        className="search-input"
                        value={selectedSalesCashSessionId}
                        onChange={event => setSalesCashSessionFilter(event.target.value)}
                      >
                        <option value="all">Todos os caixas</option>
                        {orderedCashSessions.map(session => (
                          <option key={session.id} value={session.id}>
                            {session.closedAt ? 'Fechado' : 'Aberto'} · {dateTime(session.openedAt)}
                            {session.closedAt ? ' — ' + dateTime(session.closedAt) : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="muted">
                      {selectedSalesCashSessionId === 'all'
                        ? 'Exibindo vendas de todos os caixas.'
                        : 'Exibindo somente as vendas vinculadas ao caixa selecionado.'}
                    </p>
                  </div>

                  <div className="panel table-panel">
                    <table>
                      <thead>
                        <tr>
                          <th>VENDA</th>
                          <th>DATA/HORA</th>
                          <th>ITENS</th>
                          <th>PAGAMENTO</th>
                          <th>TOTAL</th>
                          <th>STATUS</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedSales.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(sale => (
                          <tr key={sale.id}>
                            <td>#{String(sale.number).padStart(6, '0')}</td>
                            <td>{dateTime(sale.createdAt)}</td>
                            <td>{sale.items.reduce((n, item) => n + item.quantity, 0)}</td>
                            <td>{[...new Set(sale.payments.map(payment => payment.method))].join(', ')}</td>
                            <td><strong>{money(sale.total)}</strong></td>
                            <td>
                              <span className={sale.status === 'concluida' ? 'status-pill' : 'status-pill cancelled'}>
                                {sale.status === 'concluida' ? 'Concluída' : 'Cancelada'}
                              </span>
                            </td>
                            <td className="row-actions">
                              <button className="receipt-button" onClick={() => printSale(sale)}>Imprimir</button>
                              {sale.status === 'concluida' && (
                                <button className="text-button" onClick={() => void cancelSale(sale)}>Cancelar</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {displayedSales.length === 0 && (
                      <div className="empty">Nenhuma venda encontrada neste caixa.</div>
                    )}
                  </div>
                </>
              )}

              {page === 'Relatórios' && (
                <>
                  <Heading title="Relatórios" subtitle="Acompanhe vendas, produtos e recebimentos por período." />

                  <div className="report-filter panel">
                    <label className="field-label">
                      Período do relatório
                      <select value={reportPeriod} onChange={event => setReportPeriod(event.target.value as typeof reportPeriod)}>
                        <option value="today">Hoje</option>
                        <option value="week">Esta semana</option>
                        <option value="month">Este mês</option>
                        <option value="all">Todo o período</option>
                      </select>
                    </label>
                    <span className="muted">{reportSales.length} venda(s) concluída(s) no período</span>
                  </div>

                  <div className="stats-grid">
                    <Stat label="Faturamento" value={money(reportTotal)} note="Vendas não canceladas" />
                    <Stat label="Vendas concluídas" value={String(reportSales.length)} note="No período selecionado" />
                    <Stat label="Ticket médio" value={money(reportSales.length ? reportTotal / reportSales.length : 0)} note="Valor médio por venda" />
                    <Stat
                      label="Lucro estimado"
                      value={money(reportSales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) =>
                        itemSum + (item.costPrice === null ? 0 : (item.unitPrice - item.costPrice) * item.quantity), 0), 0))}
                      note="Somente itens com custo informado"
                    />
                  </div>

                  <div className="report-columns">
                    <section className="panel">
                      <PanelTitle title="Produtos mais vendidos" />
                      {bestSellingProducts.length ? bestSellingProducts.map((product, index) => (
                        <div className="report-product-row" key={product.id}>
                          <span className="report-rank">{index + 1}</span>
                          <span className="report-product-name">{product.name}</span>
                          <strong>{product.quantity} {product.unit}</strong>
                        </div>
                      )) : <div className="empty compact">Nenhuma venda de produto neste período.</div>}
                    </section>

                    <section className="panel">
                      <PanelTitle title="Produtos menos vendidos" />
                      {leastSellingProducts.length ? leastSellingProducts.map((product, index) => (
                        <div className="report-product-row" key={product.id}>
                          <span className="report-rank muted-rank">{index + 1}</span>
                          <span className="report-product-name">{product.name}</span>
                          <strong>{product.quantity} {product.unit}</strong>
                        </div>
                      )) : <div className="empty compact">Cadastre produtos para visualizar o ranking.</div>}
                    </section>
                  </div>

                  <section className="panel">
                    <PanelTitle title="Faturamento por forma de pagamento" />
                    {paymentMethods.map(method => (
                      <div className="simple-row" key={method}>
                        <span>{method}</span>
                        <strong>{money(reportPaymentTotals[method])}</strong>
                      </div>
                    ))}
                    <p className="muted">
                      Os relatórios consideram somente vendas concluídas. Vendas canceladas não entram nos totais nem nos rankings.
                      Itens Diversos não entram no ranking de produtos cadastrados.
                    </p>
                  </section>
                </>
              )}

              {page === 'Caixa' && (
                <>
                  <Heading
                    title="Controle de caixa"
                    subtitle="Cada abertura inicia uma apuração independente até o fechamento."
                  />

                  <section className="panel cash-panel">
                    <div className="cash-state">
                      <span className={cashIsOpen ? 'status-dot' : 'status-dot closed'} />
                      {cashIsOpen ? 'Caixa aberto' : 'Caixa fechado'}
                    </div>

                    {cashIsOpen && data.cashSession ? (
                      <>
                        <p>
                          Aberto em {dateTime(data.cashSession.openedAt)}
                          {' · '}
                          Fundo inicial: {money(data.cashSession.openingAmount)}
                        </p>

                        <div className="cash-live-grid">
                          <div>
                            <span>Vendas concluídas</span>
                            <strong>{activeCashSales.length}</strong>
                          </div>
                          <div>
                            <span>Faturamento</span>
                            <strong>{money(activeCashSales.reduce((sum, sale) => sum + sale.total, 0))}</strong>
                          </div>
                          <div>
                            <span>Lucro bruto estimado</span>
                            <strong>{money(activeCashProfit)}</strong>
                          </div>
                        </div>

                        <p className="muted">O lucro não inclui itens sem preço de custo cadastrado.</p>
                        <button
                          className="button-primary"
                          onClick={() => {
                            if (window.confirm('Fechar o caixa de hoje? O resumo ficará salvo no histórico.')) {
                              void run(() => window.loja.closeCash(), 'Caixa fechado. Resumo diário salvo no histórico.')
                            }
                          }}
                        >
                          Fechar caixa
                        </button>
                      </>
                    ) : (
                      <>
                        <label className="field-label">
                          Valor inicial em dinheiro (R$)
                          <input
                            ref={openingAmountRef}
                            className="search-input"
                            type="text"
                            name="openingAmount"
                            autoComplete="off"
                            spellCheck={false}
                            defaultValue="0,00"
                            placeholder="Ex.: 100,00"
                            inputMode="decimal"
                          />
                        </label>
                        <button
                          className="button-primary"
                          onClick={() => {
                            const raw = openingAmountRef.current?.value.trim() || '0'
                            const normalized = raw.includes(',')
                              ? raw.replace(/\./g, '').replace(',', '.')
                              : raw
                            void run(() => window.loja.openCash(Number(normalized)), 'Novo caixa aberto.')
                          }}
                        >
                          Abrir caixa
                        </button>
                      </>
                    )}
                  </section>

                  <section className="panel cash-history">
                    <div className="panel-heading">
                      <h2>Histórico de fechamentos</h2>
                      <span className="muted">
                        {data.cashSessions.filter(session => Boolean(session.closedAt)).length} dia(s) fechado(s)
                      </span>
                    </div>

                    {data.cashSessions.filter(session => Boolean(session.closedAt))
                      .slice()
                      .sort((a, b) => (b.closedAt || '').localeCompare(a.closedAt || ''))
                      .map(session => (
                        <article className="cash-history-card" key={session.id}>
                          <div className="cash-history-head">
                            <div>
                              <strong>{new Date(session.openedAt).toLocaleDateString('pt-BR')}</strong>
                              <small>
                                {dateTime(session.openedAt)} — {session.closedAt ? dateTime(session.closedAt) : 'Em andamento'}
                              </small>
                            </div>
                            <span className="status-pill">{session.closedAt ? 'Fechado' : 'Aberto'}</span>
                          </div>

                          {session.summary ? (
                            <>
                              <div className="cash-history-stats">
                                <div>
                                  <span>Faturamento</span>
                                  <strong>{money(session.summary.salesTotal)}</strong>
                                </div>
                                <div>
                                  <span>Lucro estimado</span>
                                  <strong>{money(session.summary.estimatedProfit)}</strong>
                                </div>
                                <div>
                                  <span>Vendas</span>
                                  <strong>{session.summary.salesCount}</strong>
                                </div>
                                <div>
                                  <span>Dinheiro esperado</span>
                                  <strong>{money(session.closingAmount || 0)}</strong>
                                </div>
                              </div>

                              <div className="cash-payment-breakdown">
                                {paymentMethods.map(method => (
                                  <span key={method}>
                                    {method}: <strong>{money(session.summary!.byPayment[method])}</strong>
                                  </span>
                                ))}
                              </div>
                            </>
                          ) : (
                            <p className="muted">
                              Este caixa foi criado antes do histórico detalhado e não possui resumo salvo.
                            </p>
                          )}

                          <div className="cash-details-actions">
                            <button
                              className="button-secondary"
                              onClick={() => setExpandedCashSessionId(current =>
                                current === session.id ? null : session.id,
                              )}
                            >
                              {expandedCashSessionId === session.id ? 'Ocultar detalhes' : 'Ver detalhes das vendas'}
                            </button>
                          </div>

                          {expandedCashSessionId === session.id && (
                            <div className="cash-sale-details">
                              {salesForCashSession(data, session)
                                .slice()
                                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                                .map(sale => (
                                  <article className="cash-sale-card" key={sale.id}>
                                    <div className="cash-sale-title">
                                      <div>
                                        <strong>Venda #{String(sale.number).padStart(6, '0')}</strong>
                                        <small>{dateTime(sale.createdAt)}</small>
                                      </div>
                                      <div className="cash-sale-total">
                                        <strong>{money(sale.total)}</strong>
                                        <span className={sale.status === 'concluida' ? 'status-pill' : 'status-pill cancelled'}>
                                          {sale.status === 'concluida' ? 'Concluída' : 'Cancelada'}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="cash-sale-items">
                                      {sale.items.map((item, index) => (
                                        <div className="cash-sale-item" key={sale.id + '-' + index}>
                                          <span>
                                            {item.quantity} × {item.name}
                                            <small>{money(item.unitPrice)} cada</small>
                                          </span>
                                          <strong>{money(item.quantity * item.unitPrice)}</strong>
                                        </div>
                                      ))}
                                    </div>

                                    <div className="cash-sale-payments">
                                      Pagamento: {sale.payments.map(payment =>
                                        payment.method + ' ' + money(payment.amount),
                                      ).join(' · ')}
                                    </div>
                                  </article>
                                ))}

                              {salesForCashSession(data, session).length === 0 && (
                                <div className="empty compact">Nenhuma venda vinculada a este caixa.</div>
                              )}
                            </div>
                          )}
                        </article>
                      ))}

                    {data.cashSessions.filter(session => Boolean(session.closedAt)).length === 0 && (
                      <div className="empty compact">
                        Os fechamentos diários aparecerão aqui depois do primeiro fechamento.
                      </div>
                    )}
                  </section>
                </>
              )}
            </>
          )}

          <footer className="page-footer">Gestão Oliveira · Aplicativo local</footer>
        </section>
      </main>

      {printQuestionSale && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal">
            <div className="modal-heading">
              <h2>Venda registrada!</h2>
              <button type="button" className="icon-button" onClick={() => setPrintQuestionSale(null)}>×</button>
            </div>
            <p>
              Deseja imprimir o comprovante da venda #{String(printQuestionSale.number).padStart(6, '0')}
              {' '}no valor de {money(printQuestionSale.total)}?
            </p>
            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={() => setPrintQuestionSale(null)}>
                Agora não
              </button>
              <button
                type="button"
                className="button-primary"
                onClick={() => {
                  const sale = printQuestionSale
                  setPrintQuestionSale(null)
                  if (sale) openReceiptOptions(sale)
                }}
              >
                Imprimir comprovante
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptSale && (
        <div className="modal-backdrop receipt-backdrop">
          <form className="modal receipt-modal" onSubmit={confirmReceiptPrint}>
            <div className="modal-heading receipt-heading">
              <div>
                <span className="receipt-eyebrow">FINALIZAÇÃO</span>
                <h2>Opções do comprovante</h2>
                <p>Personalize as informações antes de imprimir.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={() => setReceiptSale(null)}
              >
                ×
              </button>
            </div>

            <div className="receipt-sale-card">
              <div>
                <span className="receipt-info-label">VENDA</span>
                <strong>#{String(receiptSale.number).padStart(6, '0')}</strong>
              </div>
              <div className="receipt-sale-divider" />
              <div className="receipt-sale-value">
                <span className="receipt-info-label">VALOR TOTAL</span>
                <strong>{money(receiptSale.total)}</strong>
              </div>
            </div>

            <div className="receipt-section">
              <div className="receipt-section-heading">
                <span className="receipt-step">01</span>
                <div>
                  <h3>Identificação do cliente</h3>
                  <p>O nome será exibido no comprovante.</p>
                </div>
                <span className="receipt-optional">OPCIONAL</span>
              </div>

              <label className="field-label receipt-customer-field">
                Nome do cliente
                <input
                  ref={receiptCustomerNameRef}
                  type="text"
                  name="receiptCustomerName"
                  autoComplete="off"
                  spellCheck={false}
                  defaultValue=""
                  placeholder="Digite o nome do cliente"
                />
              </label>
            </div>

            <div className="receipt-section">
              <div className="receipt-section-heading">
                <span className="receipt-step">02</span>
                <div>
                  <h3>Tipo de venda</h3>
                  <p>Selecione como esta venda será identificada.</p>
                </div>
              </div>

              <div className="receipt-choice-grid">
                <button
                  type="button"
                  className={`receipt-choice-card ${!receiptIsFiado ? 'selected' : ''}`}
                  aria-pressed={!receiptIsFiado}
                  onClick={() => setReceiptIsFiado(false)}
                >
                  <span className="receipt-choice-icon">✓</span>
                  <span className="receipt-choice-content">
                    <strong>Venda normal</strong>
                    <small>Pagamento realizado</small>
                  </span>
                  <span className="receipt-radio" />
                </button>

                <button
                  type="button"
                  className={`receipt-choice-card ${receiptIsFiado ? 'selected' : ''}`}
                  aria-pressed={receiptIsFiado}
                  onClick={() => setReceiptIsFiado(true)}
                >
                  <span className="receipt-choice-icon">◷</span>
                  <span className="receipt-choice-content">
                    <strong>Fiado</strong>
                    <small>Pagamento pendente</small>
                  </span>
                  <span className="receipt-radio" />
                </button>
              </div>
            </div>

            <div className="receipt-section">
              <div className="receipt-section-heading">
                <span className="receipt-step">03</span>
                <div>
                  <h3>Vias para imprimir</h3>
                  <p>Escolha quais comprovantes serão impressos.</p>
                </div>
              </div>

              <div className="receipt-copy-options">
                <button
                  type="button"
                  className={`receipt-copy-option ${receiptCopies === 'loja' ? 'selected' : ''}`}
                  aria-pressed={receiptCopies === 'loja'}
                  onClick={() => setReceiptCopies('loja')}
                >
                  <span className="receipt-copy-icon">▤</span>
                  <span>
                    <strong>Somente via da loja</strong>
                    <small>Imprimir 1 via</small>
                  </span>
                  <span className="receipt-radio" />
                </button>

                <button
                  type="button"
                  className={`receipt-copy-option ${receiptCopies === 'loja-cliente' ? 'selected' : ''}`}
                  aria-pressed={receiptCopies === 'loja-cliente'}
                  onClick={() => setReceiptCopies('loja-cliente')}
                >
                  <span className="receipt-copy-icon">▤</span>
                  <span>
                    <strong>Loja e cliente</strong>
                    <small>Imprimir 2 vias</small>
                  </span>
                  <span className="receipt-radio" />
                </button>
              </div>
            </div>

            <div className="receipt-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setReceiptSale(null)}
              >
                Cancelar impressão
              </button>
              <button className="button-primary receipt-print-button" type="submit">
                <span>Imprimir comprovante</span>
                <span>→</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {diversosModal && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal" onSubmit={confirmDiversos}>
            <div className="modal-heading">
              <h2>Adicionar item Diversos</h2>
              <button type="button" className="icon-button" onClick={() => setDiversosModal(false)}>×</button>
            </div>
            <label className="field-label">
              Descrição
              <input
                autoFocus
                required
                value={diversosDescription}
                onChange={event => setDiversosDescription(event.target.value)}
                placeholder="Ex.: produto sem cadastro"
              />
            </label>
            <label className="field-label">
              Valor total (R$)
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={diversosPrice}
                onChange={event => setDiversosPrice(event.target.value)}
                placeholder="0,00"
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={() => setDiversosModal(false)}>Voltar</button>
              <button className="button-primary" type="submit">Adicionar à venda</button>
            </div>
          </form>
        </div>
      )}

      {(quantityModalProduct || cartQuantityItem) && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal" onSubmit={confirmAddProduct}>
            <div className="modal-heading">
              <h2>{cartQuantityItem ? 'Alterar quantidade' : 'Adicionar produto'}</h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => {
                  setQuantityModalProduct(null)
                  setCartQuantityItem(null)
                }}
              >
                ×
              </button>
            </div>

            <p>
              Produto: <strong>{cartQuantityItem?.name || quantityModalProduct?.name}</strong>
            </p>

            <p className="muted">
              Preço unitário: {money(cartQuantityItem?.unitPrice ?? quantityModalProduct?.salePrice ?? 0)}
            </p>

            <label className="field-label">
              Quantidade
              <input
                ref={quantityInputRef}
                autoFocus
                required
                type="number"
                min="1"
                step="1"
                value={quantityInput}
                onChange={event => setQuantityInput(event.target.value)}
                onFocus={event => event.currentTarget.select()}
                placeholder="1"
              />
            </label>

            <div className="modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setQuantityModalProduct(null)
                  setCartQuantityItem(null)
                }}
              >
                Cancelar
              </button>

              <button className="button-primary" type="submit">
                {cartQuantityItem ? 'Salvar quantidade' : 'Adicionar à venda'}
              </button>
            </div>
          </form>
        </div>
      )}

      {productModal && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal" onSubmit={saveProduct}>
            <div className="modal-heading">
              <h2>{editing ? 'Editar produto' : 'Novo produto'}</h2>
              <button type="button" className="icon-button" onClick={() => setProductModal(false)}>×</button>
            </div>
            <label className="field-label">
              Nome
              <input
                required
                autoFocus
                value={productForm.name}
                onChange={event => setProductForm({ ...productForm, name: event.target.value })}
              />
            </label>
            <div className="form-grid">
              <label className="field-label">
                Categoria
                <input
                  value={productForm.category}
                  onChange={event => setProductForm({ ...productForm, category: event.target.value })}
                />
              </label>
              <label className="field-label">
                Unidade
                <select
                  value={productForm.unit}
                  onChange={event => setProductForm({ ...productForm, unit: event.target.value })}
                >
                  <option value="un">Unidade</option>
                  <option value="kg">Kg</option>
                  <option value="g">Grama</option>
                  <option value="L">Litro</option>
                  <option value="ml">Ml</option>
                  <option value="cx">Caixa</option>
                </select>
              </label>
              <label className="field-label">
                Preço de custo (R$)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.costPrice}
                  onChange={event => setProductForm({ ...productForm, costPrice: event.target.value })}
                  placeholder="Opcional"
                />
              </label>
              <label className="field-label">
                Preço de venda (R$)
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={productForm.salePrice}
                  onChange={event => setProductForm({ ...productForm, salePrice: event.target.value })}
                />
              </label>
              <label className="field-label">
                Estoque inicial/atual
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={productForm.stock}
                  onChange={event => setProductForm({ ...productForm, stock: event.target.value })}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={() => setProductModal(false)}>Voltar</button>
              <button className="button-primary" type="submit">Salvar produto</button>
            </div>
          </form>
        </div>
      )}

      {checkout && (
        <div className="modal-backdrop checkout-backdrop">
          <div className="modal checkout-modal checkout-modal-improved">
            <div className="modal-heading checkout-heading">
              <div>
                <span className="checkout-eyebrow">FINALIZAÇÃO DA VENDA</span>
                <h2>Receber pagamento</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setCheckout(false)}>×</button>
            </div>

            <div className="checkout-total-card">
              <div>
                <span className="checkout-total-label">TOTAL DA VENDA</span>
                <strong className="checkout-total-value">{money(total)}</strong>
              </div>
              <span className="checkout-total-icon">R$</span>
            </div>

            <div className="payment-section-heading">
              <div>
                <h3>Formas de pagamento</h3>
                <p>Informe como o cliente está pagando.</p>
              </div>
              <span className="payment-count">
                {checkoutPayments.length} {checkoutPayments.length === 1 ? 'forma' : 'formas'}
              </span>
            </div>

            <div className="payment-lines payment-lines-improved">
              {checkoutPayments.map((payment, index) => (
                <div className="payment-line payment-line-improved" key={index}>
                  <div className="payment-line-heading">
                    <span className="payment-number">{String(index + 1).padStart(2, '0')}</span>
                    <strong>Pagamento {index + 1}</strong>
                    {checkoutPayments.length > 1 && (
                      <button
                        type="button"
                        className="payment-remove payment-remove-improved"
                        aria-label={`Remover pagamento ${index + 1}`}
                        title="Remover forma de pagamento"
                        onClick={() => setCheckoutPayments(rows => rows.filter((_, i) => i !== index))}
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <div className="payment-fields">
                    <label className="field-label">
                      Forma de pagamento
                      <select
                        value={payment.method}
                        onChange={event => setCheckoutPayments(rows =>
                          rows.map((row, i) => i === index
                            ? { ...row, method: event.target.value as Payment['method'] }
                            : row),
                        )}
                      >
                        {paymentMethods.map(method => <option key={method}>{method}</option>)}
                      </select>
                    </label>

                    <label className="field-label">
                      Valor recebido
                      <div className="payment-amount-field">
                        <span>R$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={payment.amount}
                          onChange={event => setCheckoutPayments(rows =>
                            rows.map((row, i) => i === index
                              ? { ...row, amount: event.target.value === '' ? 0 : Number(event.target.value) }
                              : row),
                          )}
                        />
                      </div>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="add-payment-button"
              disabled={paymentRemaining <= 0 || checkoutPayments.length >= paymentMethods.length}
              onClick={addPaymentLine}
            >
              <span>＋</span>
              Adicionar outra forma de pagamento
            </button>

            <div className="payment-summary payment-summary-improved">
              <div className="payment-summary-item">
                <span>Valor informado</span>
                <strong>{money(paymentTotal)}</strong>
              </div>
              <div className="payment-summary-item">
                <span>{paymentRemaining >= 0 ? 'Falta pagar' : 'Valor excedente'}</span>
                <strong className={
                  Math.abs(paymentRemaining) < 0.01
                    ? 'payment-balanced'
                    : paymentRemaining < 0
                      ? 'payment-overpaid'
                      : 'payment-pending'
                }>
                  {money(Math.abs(paymentRemaining))}
                </strong>
              </div>
            </div>

            <div className={
              paymentValid
                ? 'payment-status payment-status-complete'
                : paymentRemaining < 0
                  ? 'payment-status payment-status-excess'
                  : 'payment-status payment-status-pending'
            }>
              <span className="payment-status-icon">
                {paymentValid ? '✓' : paymentRemaining < 0 ? '!' : '…'}
              </span>
              <div>
                <strong>
                  {paymentValid
                    ? 'Pagamento completo'
                    : paymentRemaining < 0
                      ? 'Valor acima do total'
                      : 'Pagamento pendente'}
                </strong>
                <span>
                  {paymentValid
                    ? 'Os valores estão certos. A venda pode ser concluída.'
                    : paymentRemaining < 0
                      ? 'Reduza o valor informado para fechar exatamente o total da venda.'
                      : 'Informe o valor restante para concluir a venda.'}
                </span>
              </div>
            </div>

            <div className="modal-actions checkout-actions">
              <button type="button" className="button-secondary" onClick={() => setCheckout(false)}>
                Voltar
              </button>
              <button
                type="button"
                className="button-primary checkout-confirm-button"
                disabled={!paymentValid}
                onClick={() => void confirmSale()}
              >
                Confirmar venda
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Heading({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  )
}

function PanelTitle({ title }: { title: string }) {
  return <div className="panel-heading"><h2>{title}</h2></div>
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  )
}

function Shortcut({ title, text, onClick }: { title: string; text: string; onClick: () => void }) {
  return (
    <button className="shortcut" onClick={onClick}>
      <span className="shortcut-icon">↗</span>
      <span><strong>{title}</strong><small>{text}</small></span>
      <span className="arrow">→</span>
    </button>
  )
}

export default App
