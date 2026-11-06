import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'

const api = axios.create({
  baseURL: 'http://localhost:4000/api',
  withCredentials: true,
  validateStatus: (status) => status >= 200 && status < 500,
})

const AuthContext = createContext(null)

const categories = [
  'Productivity',
  'Creativity',
  'Startups',
  'Culture',
  'Design',
  'Travel',
  'Wellbeing',
]

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const cardMotion = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.45, ease: 'easeOut' },
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AuthProvider>
  )
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchCurrentUser = async () => {
    try {
      const { data } = await api.get('/auth/me')
      setUser(data.user)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  const login = async (payload) => {
    const response = await api.post('/auth/login', payload)
    if (response.status >= 400) {
      throw new Error(response.data?.message || 'Unable to log in.')
    }
    setUser(response.data.user)
    return response.data.user
  }

  const register = async (payload) => {
    const response = await api.post('/auth/register', payload)
    if (response.status >= 400) {
      throw new Error(response.data?.message || 'Unable to create account.')
    }
    setUser(response.data.user)
    return response.data.user
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      setUser(null)
    }
  }

  const updateUser = (nextUser) => setUser(nextUser)

  const value = useMemo(
    () => ({ user, setUser: updateUser, loading, login, register, logout }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

function AppLayout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8"
        >
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/blogs" element={<BlogsPage />} />
            <Route path="/blog/:slug" element={<BlogDetailPage />} />
            <Route path="/creator/:username" element={<CreatorPublicPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <ProfilePage />
                </PrivateRoute>
              }
            />
            <Route
              path="/saved"
              element={
                <PrivateRoute>
                  <SavedPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <CreatorRoute>
                  <DashboardPage />
                </CreatorRoute>
              }
            />
            <Route
              path="/write"
              element={
                <CreatorRoute>
                  <WritePage />
                </CreatorRoute>
              }
            />
            <Route
              path="/edit/:id"
              element={
                <CreatorRoute>
                  <EditBlogPage />
                </CreatorRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </motion.main>
      </AnimatePresence>
    </div>
  )
}

function Navbar() {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-bold text-white shadow-lg shadow-indigo-500/25">
            I
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight text-slate-900">Inkflow</div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Thoughtful writing</div>
          </div>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <NavLink to="/" className={({ isActive }) => `text-sm font-medium ${isActive ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
            Home
          </NavLink>
          <NavLink to="/blogs" className={({ isActive }) => `text-sm font-medium ${isActive ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
            Blogs
          </NavLink>
          {user && (
            <>
              <NavLink to="/saved" className={({ isActive }) => `text-sm font-medium ${isActive ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
                Saved
              </NavLink>
              {user.role !== 'reader' && (
                <NavLink to="/dashboard" className={({ isActive }) => `text-sm font-medium ${isActive ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>
                  Dashboard
                </NavLink>
              )}
            </>
          )}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Link to="/profile" className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300">
                <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
                <span>{user.name}</span>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900">
                Login
              </Link>
              <Link to="/register" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800">
                Create account
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          className="inline-flex rounded-full border border-slate-200 bg-white p-2 text-slate-700 md:hidden"
        >
          ☰
        </button>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-slate-200 bg-white md:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4">
              <NavLink to="/" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                Home
              </NavLink>
              <NavLink to="/blogs" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                Blogs
              </NavLink>
              {user ? (
                <>
                  <NavLink to="/saved" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                    Saved
                  </NavLink>
                  <NavLink to="/profile" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                    Profile
                  </NavLink>
                  <button type="button" onClick={logout} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-700">
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMenuOpen(false)} className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                    Login
                  </Link>
                  <Link to="/register" onClick={() => setMenuOpen(false)} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white">
                    Create account
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

function HomePage() {
  const { user } = useAuth()
  const [blogs, setBlogs] = useState([])
  const [loading, setLoading] = useState(true)

  const startWritingPath = user ? (user.role === 'reader' ? '/profile' : '/write') : '/register'

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/blogs', { params: { sort: 'latest', page: 1 } })
        setBlogs(data.blogs)
      } catch {
        setBlogs([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const featured = blogs.slice(0, 2)
  const latest = blogs.slice(0, 4)

  return (
    <div className="space-y-12 pt-3 sm:pt-6">
      <section className="glass-panel relative overflow-hidden rounded-[32px] p-6 sm:p-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.12),transparent_30%)]" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">
              New writing weekly
            </span>
            <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Stories, ideas and rituals worth keeping.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-slate-600">
              Inkflow helps thoughtful people publish essays, notes and practical inspiration without noise.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/blogs" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800">
                Explore blogs
              </Link>
              <Link to={startWritingPath} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300">
                {user && user.role !== 'reader' ? 'Start writing' : 'Become a creator'}
              </Link>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="rounded-[28px] bg-white p-4 shadow-2xl shadow-slate-200/80 ring-1 ring-slate-200">
              <img
                src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80"
                alt="Creative desk"
                className="h-[420px] w-full rounded-[24px] object-cover"
              />
            </div>
          </motion.div>
        </div>
      </section>

      <section>
        <SectionHeader title="Featured writing" subtitle="Fresh perspectives worth a slow read." />
        {loading ? (
          <LoadingGrid count={2} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {featured.map((blog) => (
              <BlogCard key={blog.id} blog={blog} />
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader title="Browse by category" subtitle="Focused ideas for curious minds." />
        <div className="flex flex-wrap gap-3">
          {categories.map((category) => (
            <Link
              key={category}
              to={`/blogs?category=${encodeURIComponent(category)}`}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
            >
              {category}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Latest from the journal" subtitle="Short reads and deep notes for your next idea." />
        {loading ? (
          <LoadingGrid count={4} />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {latest.map((blog) => (
              <BlogCard key={blog.id} blog={blog} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function BlogsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [blogs, setBlogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(Number(searchParams.get('page') || 1))
  const [totalPages, setTotalPages] = useState(1)

  const search = searchParams.get('q') || ''
  const category = searchParams.get('category') || 'All'
  const sort = searchParams.get('sort') || 'latest'

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const { data } = await api.get('/blogs', {
          params: { search, category: category === 'All' ? '' : category, sort, page },
        })
        setBlogs(data.blogs)
        setTotalPages(data.totalPages || 1)
      } catch {
        setBlogs([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [search, category, sort, page])

  const updateFilters = (nextValues) => {
    const params = new URLSearchParams(searchParams)
    Object.entries(nextValues).forEach(([key, value]) => {
      if (value) params.set(key, value)
      else params.delete(key)
    })
    setPage(1)
    setSearchParams(params)
  }

  return (
    <div className="space-y-8 pt-2">
      <section className="glass-panel rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Library</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Discover the next story.</h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={search}
              onChange={(event) => updateFilters({ q: event.target.value })}
              placeholder="Search blogs"
              className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-indigo-300 sm:w-64"
            />
            <select
              value={category}
              onChange={(event) => updateFilters({ category: event.target.value })}
              className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-300"
            >
              <option value="All">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(event) => updateFilters({ sort: event.target.value })}
              className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-indigo-300"
            >
              <option value="latest">Latest</option>
              <option value="popular">Most viewed</option>
              <option value="liked">Most liked</option>
            </select>
          </div>
        </div>
      </section>

      {loading ? (
        <LoadingGrid count={6} />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {blogs.map((blog) => (
              <BlogCard key={blog.id} blog={blog} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
                disabled={page === 1}
              >
                Prev
              </button>
              <span className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-40"
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function BlogDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [blog, setBlog] = useState(null)
  const [commentText, setCommentText] = useState('')

  const loadBlog = async () => {
    const { data } = await api.get(`/blogs/${slug}`)
    setBlog(data.blog)
  }

  useEffect(() => {
    loadBlog().catch(() => setBlog(null))
  }, [slug])

  const handleLike = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    const { data } = await api.post(`/blogs/${blog.id}/like`)
    setBlog((current) => ({ ...current, liked: data.liked, likes: data.likesCount }))
  }

  const handleBookmark = async () => {
    if (!user) {
      navigate('/login')
      return
    }
    const { data } = await api.post(`/blogs/${blog.id}/bookmark`)
    setBlog((current) => ({ ...current, bookmarked: data.bookmarked }))
  }

  const handleComment = async (event) => {
    event.preventDefault()
    if (!user) {
      navigate('/login')
      return
    }
    if (!commentText.trim()) return
    await api.post(`/blogs/${blog.id}/comments`, { text: commentText })
    setCommentText('')
    loadBlog()
  }

  if (!blog) {
    return <div className="pt-12 text-center text-slate-500">Loading article...</div>
  }

  return (
    <article className="mx-auto max-w-4xl space-y-8 pb-10 pt-4">
      <header className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span className="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700">{blog.category}</span>
          <span>{blog.readTime} min read</span>
          <span>•</span>
          <span>{formatDate(blog.publishedAt)}</span>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">{blog.title}</h1>
        <div className="flex items-center justify-between gap-4 rounded-[22px] border border-slate-200 bg-white p-4">
          <Link to={`/creator/${blog.author.username}`} className="flex items-center gap-3">
            <img src={blog.author.avatar} alt={blog.author.name} className="h-12 w-12 rounded-full object-cover" />
            <div>
              <div className="font-semibold text-slate-900">{blog.author.name}</div>
              <div className="text-sm text-slate-500">@{blog.author.username}</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLike}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${blog.liked ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white text-slate-700'}`}
            >
              {blog.liked ? '♥ Liked' : '♡ Like'} · {blog.likes}
            </button>
            <button
              type="button"
              onClick={handleBookmark}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${blog.bookmarked ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'}`}
            >
              {blog.bookmarked ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      </header>

      <img src={blog.coverImage} alt={blog.title} className="h-[360px] w-full rounded-[28px] object-cover shadow-xl shadow-slate-200/80 sm:h-[460px]" />

      <div className="article-body rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-8" dangerouslySetInnerHTML={{ __html: blog.content }} />

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 sm:p-7">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-2xl font-semibold text-slate-900">Comments</h3>
          <span className="text-sm text-slate-500">{blog.comments?.length || 0} notes</span>
        </div>

        <form onSubmit={handleComment} className="mb-6 flex flex-col gap-3 sm:flex-row">
          <textarea
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder="Add your perspective..."
            className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 outline-none transition focus:border-indigo-300"
          />
          <button type="submit" className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 sm:self-end">
            Post comment
          </button>
        </form>

        <div className="space-y-4">
          {(blog.comments || []).map((comment) => (
            <div key={comment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center gap-3">
                <img src={comment.user.avatar} alt={comment.user.name} className="h-9 w-9 rounded-full object-cover" />
                <div>
                  <div className="font-semibold text-slate-900">{comment.user.name}</div>
                  <div className="text-xs text-slate-500">{formatDate(comment.createdAt)}</div>
                </div>
              </div>
              <p className="text-slate-700">{comment.text}</p>
            </div>
          ))}
        </div>
      </section>
    </article>
  )
}

function ProfilePage() {
  const { user, setUser } = useAuth()
  const [form, setForm] = useState({
    name: user?.name || '',
    bio: user?.bio || '',
    avatar: user?.avatar || '',
  })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const { data } = await api.put('/users/me', form)
    setUser(data.user)
  }

  const handleBecomeCreator = async () => {
    const { data } = await api.put('/users/become-creator')
    setUser(data.user)
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="glass-panel rounded-[28px] p-6">
        <h2 className="text-3xl font-semibold text-slate-900">Profile</h2>
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Display name</label>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none focus:border-indigo-300"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Avatar URL</label>
            <input
              value={form.avatar}
              onChange={(event) => setForm((current) => ({ ...current, avatar: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none focus:border-indigo-300"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Bio</label>
            <textarea
              value={form.bio}
              onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
              rows={5}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none focus:border-indigo-300"
            />
          </div>
          <button type="submit" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
            Save profile
          </button>
        </form>
      </section>

      <section className="glass-panel rounded-[28px] p-6">
        <div className="flex items-center gap-4">
          <img src={user.avatar} alt={user.name} className="h-16 w-16 rounded-full object-cover" />
          <div>
            <div className="text-xl font-semibold text-slate-900">{user.name}</div>
            <div className="text-sm text-slate-500">@{user.username}</div>
          </div>
        </div>
        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          <div className="mb-2 font-medium text-slate-900">Current role</div>
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
            {user.role}
          </span>
        </div>
        {user.role === 'reader' && (
          <button
            type="button"
            onClick={handleBecomeCreator}
            className="mt-6 w-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20"
          >
            Become a Creator
          </button>
        )}
        <Link to="/dashboard" className="mt-4 block rounded-full border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800 hover:border-slate-300">
          Go to dashboard
        </Link>
      </section>
    </div>
  )
}

function SavedPage() {
  const [blogs, setBlogs] = useState([])

  useEffect(() => {
    const load = async () => {
      const { data } = await api.get('/users/me/bookmarks')
      setBlogs(data.blogs)
    }

    load()
  }, [])

  return (
    <div className="space-y-6 pt-2">
      <SectionHeader title="Saved reading list" subtitle="Everything you bookmarked for later." />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {blogs.map((blog) => (
          <BlogCard key={blog.id} blog={blog} />
        ))}
      </div>
    </div>
  )
}

function DashboardPage() {
  const [blogs, setBlogs] = useState([])

  useEffect(() => {
    const load = async () => {
      const { data } = await api.get('/blogs/mine')
      setBlogs(data.blogs)
    }

    load()
  }, [])

  const handleDelete = async (id) => {
    const confirmed = window.confirm('Delete this blog?')
    if (!confirmed) return
    await api.delete(`/blogs/${id}`)
    setBlogs((current) => current.filter((blog) => blog.id !== id))
  }

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between gap-4">
        <SectionHeader title="Creator dashboard" subtitle="Track your posts, drafts and engagement." />
        <Link to="/write" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
          New post
        </Link>
      </div>

      <div className="grid gap-4">
        {blogs.map((blog) => (
          <motion.div key={blog.id} layout className="glass-panel flex flex-col gap-4 rounded-[24px] p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <img src={blog.coverImage} alt={blog.title} className="h-24 w-24 rounded-2xl object-cover" />
              <div>
                <div className="text-sm font-medium uppercase tracking-[0.16em] text-indigo-600">{blog.status}</div>
                <Link to={`/blog/${blog.slug}`} className="mt-1 block text-xl font-semibold text-slate-900 hover:text-indigo-700">
                  {blog.title}
                </Link>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
                  <span>{blog.views} views</span>
                  <span>{blog.likes.length} likes</span>
                  <span>{blog.comments?.length || 0} comments</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/edit/${blog.id}`} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-300">
                Edit
              </Link>
              <button type="button" onClick={() => handleDelete(blog.id)} className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700">
                Delete
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function WritePage() {
  return <BlogEditor mode="create" />
}

function EditBlogPage() {
  const { id } = useParams()
  return <BlogEditor mode="edit" blogId={id} />
}

function BlogEditor({ mode = 'create', blogId = null }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    title: '',
    content: '',
    category: 'Productivity',
    tags: '',
    coverImage: '',
    status: 'draft',
  })
  const [loading, setLoading] = useState(mode === 'edit')
  const [validationError, setValidationError] = useState('')
  const [coverMode, setCoverMode] = useState('url')
  const [previewMode, setPreviewMode] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    if (mode !== 'edit') return

    const load = async () => {
      const { data } = await api.get('/blogs/mine')
      const blog = data.blogs.find((item) => item.id === blogId)
      if (blog) {
        setForm({
          title: blog.title,
          content: blog.content,
          category: blog.category,
          tags: blog.tags.join(', '),
          coverImage: blog.coverImage,
          status: blog.status,
        })
      }
      setLoading(false)
    }

    load()
  }, [blogId, mode])

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    if (validationError) setValidationError('')
  }

  const applyImageValue = (value) => {
    handleChange('coverImage', value)
    setCoverMode('file')
  }

  const handleCoverFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      applyImageValue(String(reader.result))
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = async (event) => {
    event.preventDefault()
    setDragActive(false)
    const file = event.dataTransfer?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      applyImageValue(String(reader.result))
    }
    reader.readAsDataURL(file)
  }

  const validateForm = (payload) => {
    const trimmedTitle = payload.title.trim()
    const trimmedContent = payload.content.trim()
    const trimmedCategory = payload.category.trim()
    const rawTags = Array.isArray(payload.tags)
      ? payload.tags
      : String(payload.tags ?? '').split(',')
    const tagsList = rawTags.map((tag) => String(tag).trim()).filter(Boolean)
    const hasCoverImage = Boolean(payload.coverImage && payload.coverImage.trim())

    if (!trimmedTitle) return 'Title is required.'
    if (!trimmedContent) return 'Story content is required.'
    if (!trimmedCategory) return 'Category is required.'
    if (tagsList.length === 0) return 'Please add at least one tag.'
    if (!hasCoverImage) return 'Please choose a cover image from your device or enter a valid image URL.'

    return ''
  }

  const submitBlog = async (nextStatus) => {
    const payload = {
      ...form,
      title: form.title.trim(),
      content: form.content.trim(),
      category: form.category.trim(),
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      status: nextStatus,
    }

    const validationMessage = validateForm(payload)
    if (validationMessage) {
      setValidationError(validationMessage)
      return
    }

    if (mode === 'edit') {
      await api.put(`/blogs/${blogId}`, payload)
      navigate('/dashboard')
      return
    }

    await api.post('/blogs', payload)
    navigate('/dashboard')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    await submitBlog(form.status)
  }

  if (loading) {
    return <div className="pt-8 text-center text-slate-500">Loading editor...</div>
  }

  if (previewMode) {
    const previewTags = form.tags.split(',').map((tag) => tag.trim()).filter(Boolean)

    return (
      <section className="glass-panel rounded-[28px] p-6 sm:p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-3xl font-semibold text-slate-900">Preview</h2>
          <button type="button" onClick={() => setPreviewMode(false)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300">
            Back to editor
          </button>
        </div>

        <article className="space-y-6">
          {form.coverImage && <img src={form.coverImage} alt={form.title || 'Blog cover'} className="h-[260px] w-full rounded-[24px] object-cover" />}
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700">{form.category}</span>
            <span>{previewTags.length ? `${previewTags.length} tags` : 'No tags yet'}</span>
          </div>
          <h3 className="text-3xl font-semibold text-slate-900">{form.title || 'Untitled post'}</h3>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 text-slate-700">
            {form.content ? (
              <div dangerouslySetInnerHTML={{ __html: form.content }} />
            ) : (
              <p>Your story preview will appear here.</p>
            )}
          </div>
        </article>
      </section>
    )
  }

  return (
    <section className="glass-panel rounded-[28px] p-6 sm:p-8">
      <h2 className="text-3xl font-semibold text-slate-900">{mode === 'edit' ? 'Edit post' : 'Write a new post'}</h2>
      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
            <span>Title</span>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-600">Required</span>
          </label>
          <input
            value={form.title}
            onChange={(event) => handleChange('title', event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-300"
          />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <span>Category</span>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-600">Required</span>
            </label>
            <select
              value={form.category}
              onChange={(event) => handleChange('category', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-300"
            >
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <span>Tags</span>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-600">Required</span>
            </label>
            <input
              value={form.tags}
              onChange={(event) => handleChange('tags', event.target.value)}
              placeholder="productivity, rituals, systems"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-300"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
            <span>Cover image</span>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-600">Required</span>
          </label>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCoverMode('url')}
              className={`rounded-full px-3 py-2 text-sm font-medium ${coverMode === 'url' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
            >
              Use image URL
            </button>
            <button
              type="button"
              onClick={() => setCoverMode('file')}
              className={`rounded-full px-3 py-2 text-sm font-medium ${coverMode === 'file' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
            >
              Choose from device
            </button>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-4 transition ${dragActive ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}
          >
            {coverMode === 'file' ? (
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverFile}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-300"
              />
            ) : (
              <input
                value={form.coverImage}
                onChange={(event) => handleChange('coverImage', event.target.value)}
                placeholder="https://example.com/cover-image.jpg"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-300"
              />
            )}
          </div>

          {form.coverImage && (
            <img src={form.coverImage} alt="Cover preview" className="mt-4 h-48 w-full rounded-2xl object-cover" />
          )}
        </div>

        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
            <span>Story</span>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-600">Required</span>
          </label>
          <textarea
            value={form.content}
            onChange={(event) => handleChange('content', event.target.value)}
            rows={16}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-indigo-300"
          />
        </div>

        {validationError && <p className="text-sm text-rose-600">{validationError}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setPreviewMode(true)} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300">
            Preview post
          </button>
          <button type="button" onClick={() => submitBlog('draft')} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300">
            Save draft
          </button>
          <button type="button" onClick={() => submitBlog('published')} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
            Publish now
          </button>
        </div>
      </form>
    </section>
  )
}

function CreatorPublicPage() {
  const { username } = useParams()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await api.get(`/users/${username}`)
      setProfile(data)
    }
    load()
  }, [username])

  if (!profile) {
    return <div className="pt-8 text-center text-slate-500">Loading creator profile...</div>
  }

  return (
    <div className="space-y-8 pt-2">
      <section className="glass-panel rounded-[28px] p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <img src={profile.user.avatar} alt={profile.user.name} className="h-24 w-24 rounded-full object-cover" />
          <div>
            <div className="text-3xl font-semibold text-slate-900">{profile.user.name}</div>
            <div className="mt-1 text-slate-500">@{profile.user.username}</div>
            <p className="mt-3 max-w-xl text-slate-600">{profile.user.bio}</p>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader title="Published stories" subtitle={`By ${profile.user.name}`} />
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {profile.blogs.map((blog) => (
            <BlogCard key={blog.id} blog={blog} />
          ))}
        </div>
      </section>
    </div>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const { login, logout, user } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' })

  if (user) {
    return (
      <div className="mx-auto max-w-xl pt-8">
        <div className="glass-panel rounded-[28px] p-6 sm:p-8">
          <h2 className="text-3xl font-semibold text-slate-900">Already signed in</h2>
          <p className="mt-3 text-slate-600">You are currently logged in as <span className="font-semibold text-slate-900">{user.name}</span>.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => navigate('/')} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
              Go to home
            </button>
            <button
              type="button"
              onClick={async () => {
                await logout()
                navigate('/login')
              }}
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              Use another account
            </button>
          </div>
        </div>
      </div>
    )
  }

  const validateForm = () => {
    const nextErrors = { email: '', password: '' }
    const email = form.email.trim()
    const password = form.password.trim()

    if (!email) {
      nextErrors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Please enter a valid email address.'
    }

    if (!password) {
      nextErrors.password = 'Password is required.'
    }

    return nextErrors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationErrors = validateForm()
    setFieldErrors(validationErrors)

    if (validationErrors.email || validationErrors.password) {
      return
    }

    try {
      setError('')
      await login({ ...form, email: form.email.trim(), password: form.password.trim() })
      navigate('/')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to log in.')
    }
  }

  const handleFieldChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: '' }))
    if (error) setError('')
  }

  return (
    <div className="mx-auto max-w-xl pt-8">
      <div className="glass-panel rounded-[28px] p-6 sm:p-8">
        <h2 className="text-3xl font-semibold text-slate-900">Log in</h2>
        <p className="mt-2 text-slate-600">Welcome back to Inkflow.</p>
        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => handleFieldChange('email', event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              className={`w-full rounded-2xl border bg-white px-4 py-3 outline-none focus:border-indigo-300 ${fieldErrors.email ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200'}`}
            />
            {fieldErrors.email && <p className="mt-2 text-sm text-rose-600">{fieldErrors.email}</p>}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(event) => handleFieldChange('password', event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              className={`w-full rounded-2xl border bg-white px-4 py-3 outline-none focus:border-indigo-300 ${fieldErrors.password ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200'}`}
            />
            {fieldErrors.password && <p className="mt-2 text-sm text-rose-600">{fieldErrors.password}</p>}
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button type="submit" className="w-full rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
            Continue
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Need an account?{' '}
          <Link to="/register" className="font-semibold text-indigo-600">Sign up</Link>
        </p>
      </div>
    </div>
  )
}

function RegisterPage() {
  const navigate = useNavigate()
  const { logout, register, user } = useAuth()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({ name: '', email: '', password: '' })

  if (user) {
    return (
      <div className="mx-auto max-w-xl pt-8">
        <div className="glass-panel rounded-[28px] p-6 sm:p-8">
          <h2 className="text-3xl font-semibold text-slate-900">Already signed in</h2>
          <p className="mt-3 text-slate-600">You are already using <span className="font-semibold text-slate-900">{user.name}</span> on this device.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => navigate('/')} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
              Go to home
            </button>
            <button
              type="button"
              onClick={async () => {
                await logout()
                navigate('/register')
              }}
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
            >
              Create another account
            </button>
          </div>
        </div>
      </div>
    )
  }

  const validateForm = () => {
    const nextErrors = { name: '', email: '', password: '' }
    const name = form.name.trim()
    const email = form.email.trim()
    const password = form.password.trim()

    if (!name) {
      nextErrors.name = 'Name is required.'
    } else if (name.length < 2) {
      nextErrors.name = 'Name should be at least 2 characters.'
    }

    if (!email) {
      nextErrors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Please enter a valid email address.'
    }

    if (!password) {
      nextErrors.password = 'Password is required.'
    } else if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters.'
    }

    return nextErrors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const validationErrors = validateForm()
    setFieldErrors(validationErrors)

    if (validationErrors.name || validationErrors.email || validationErrors.password) {
      return
    }

    try {
      setError('')
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password.trim(),
      })
      navigate('/')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to create account.')
    }
  }

  const handleFieldChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: '' }))
    if (error) setError('')
  }

  return (
    <div className="mx-auto max-w-xl pt-8">
      <div className="glass-panel rounded-[28px] p-6 sm:p-8">
        <h2 className="text-3xl font-semibold text-slate-900">Create account</h2>
        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
            <input
              value={form.name}
              onChange={(event) => handleFieldChange('name', event.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
              className={`w-full rounded-2xl border bg-white px-4 py-3 outline-none focus:border-indigo-300 ${fieldErrors.name ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200'}`}
            />
            {fieldErrors.name && <p className="mt-2 text-sm text-rose-600">{fieldErrors.name}</p>}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => handleFieldChange('email', event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              className={`w-full rounded-2xl border bg-white px-4 py-3 outline-none focus:border-indigo-300 ${fieldErrors.email ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200'}`}
            />
            {fieldErrors.email && <p className="mt-2 text-sm text-rose-600">{fieldErrors.email}</p>}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(event) => handleFieldChange('password', event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              className={`w-full rounded-2xl border bg-white px-4 py-3 outline-none focus:border-indigo-300 ${fieldErrors.password ? 'border-rose-300 focus:border-rose-400' : 'border-slate-200'}`}
            />
            {fieldErrors.password && <p className="mt-2 text-sm text-rose-600">{fieldErrors.password}</p>}
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button type="submit" className="w-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20">
            Create account
          </button>
        </form>
      </div>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl pt-16 text-center">
      <div className="glass-panel rounded-[28px] p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">404</p>
        <h2 className="mt-4 text-4xl font-semibold text-slate-900">This page drifted away.</h2>
        <p className="mt-3 text-slate-600">The story you want isn’t here, but there are plenty more in the archive.</p>
        <Link to="/blogs" className="mt-6 inline-block rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
          Explore blogs
        </Link>
      </div>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="pt-8 text-center text-slate-500">Loading...</div>
  if (!user) return <Navigate to="/login" replace />

  return children
}

function CreatorRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="pt-8 text-center text-slate-500">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'reader') return <Navigate to="/profile" replace />

  return children
}

function BlogCard({ blog, compact = false }) {
  return (
    <motion.article
      {...cardMotion}
      className={`group overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${compact ? 'flex h-full flex-col' : ''}`}
    >
      <Link to={`/blog/${blog.slug}`} className="block">
        <div className="overflow-hidden">
          <img
            src={blog.coverImage}
            alt={blog.title}
            className={`w-full object-cover transition duration-500 group-hover:scale-105 ${compact ? 'h-52' : 'h-64'}`}
          />
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
          <span>{blog.category}</span>
          <span>{blog.readTime} min</span>
        </div>
        <Link to={`/blog/${blog.slug}`} className="block flex-1">
          <h3 className="text-2xl font-semibold tracking-tight text-slate-900 transition group-hover:text-indigo-700">
            {blog.title}
          </h3>
        </Link>
        <p className="mt-3 text-sm leading-6 text-slate-600">{blog.excerpt}</p>
        <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
          <div className="flex items-center gap-3">
            <img src={blog.author.avatar} alt={blog.author.name} className="h-8 w-8 rounded-full object-cover" />
            <span>{blog.author.name}</span>
          </div>
          <span>{formatDate(blog.publishedAt || new Date().toISOString())}</span>
        </div>
      </div>
    </motion.article>
  )
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-600">Inkflow</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{title}</h2>
      </div>
      {subtitle && <p className="hidden text-sm text-slate-500 md:block">{subtitle}</p>}
    </div>
  )
}

function LoadingGrid({ count }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="animate-pulse overflow-hidden rounded-[26px] border border-slate-200 bg-white">
          <div className="h-64 bg-slate-200" />
          <div className="space-y-4 p-5">
            <div className="h-4 w-20 rounded-full bg-slate-200" />
            <div className="h-7 w-3/4 rounded bg-slate-200" />
            <div className="h-4 w-full rounded bg-slate-200" />
            <div className="h-4 w-2/3 rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default App
