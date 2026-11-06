import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { fileURLToPath, pathToFileURL } from 'node:url';

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'inkflow-secret';

let memoryServer;

const getMongoConnectionString = async () => {
  if (process.env.MONGO_URI) {
    return process.env.MONGO_URI;
  }

  if (process.env.NODE_ENV === 'test') {
    memoryServer = await MongoMemoryServer.create();
    return memoryServer.getUri();
  }

  const localMongoUri = 'mongodb://127.0.0.1:27017/inkflow-blog';

  try {
    await mongoose.connect(localMongoUri, { serverSelectionTimeoutMS: 1500 });
    await mongoose.connection.close();
    return localMongoUri;
  } catch {
    memoryServer = await MongoMemoryServer.create();
    console.warn('No persistent MongoDB detected at localhost:27017. Falling back to a temporary MongoMemoryServer instance. Set MONGO_URI to keep data between restarts.');
    return memoryServer.getUri();
  }
};
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    avatar: { type: String, default: '' },
    bio: { type: String, default: '' },
    role: { type: String, enum: ['reader', 'creator', 'admin'], default: 'reader' },
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Blog' }],
  },
  { timestamps: true },
);

const commentSchema = new mongoose.Schema(
  {
    blog: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    content: { type: String, required: true },
    excerpt: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    category: { type: String, required: true },
    tags: [{ type: String }],
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: { type: Date, default: null },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    views: { type: Number, default: 0 },
    readTime: { type: Number, default: 3 },
  },
  { timestamps: true },
);

const User = mongoose.model('User', userSchema);
const Blog = mongoose.model('Blog', blogSchema);
const Comment = mongoose.model('Comment', commentSchema);

const buildSlug = (title) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const formatExcerpt = (content) =>
  `${content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)}...`;

const readTime = (content) => {
  const words = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
};

const toId = (value) => (value ? String(value) : null);

const serializeUser = (user) => ({
  id: toId(user._id || user.id),
  name: user.name,
  username: user.username,
  email: user.email,
  avatar: user.avatar,
  bio: user.bio,
  role: user.role,
  bookmarks: Array.isArray(user.bookmarks) ? user.bookmarks.map((bookmark) => toId(bookmark)) : [],
});

const projectAuthor = (author) => (
  author
    ? {
        id: toId(author._id || author.id),
        name: author.name,
        username: author.username,
        avatar: author.avatar,
        bio: author.bio,
      }
    : null
);

const serializeBlog = (blog, viewerUserId = null) => {
  const raw = blog.toObject ? blog.toObject() : blog;
  const author = raw.author && typeof raw.author === 'object' ? raw.author : null;
  const likes = Array.isArray(raw.likes) ? raw.likes : [];

  return {
    id: toId(raw._id || raw.id),
    title: raw.title,
    slug: raw.slug,
    content: raw.content,
    excerpt: raw.excerpt,
    coverImage: raw.coverImage,
    category: raw.category,
    tags: raw.tags || [],
    status: raw.status,
    publishedAt: raw.publishedAt ? new Date(raw.publishedAt).toISOString() : null,
    views: raw.views || 0,
    readTime: raw.readTime || 3,
    likes: likes.map((item) => toId(item)),
    liked: Boolean(viewerUserId && likes.some((item) => toId(item) === String(viewerUserId))),
    author: projectAuthor(author),
  };
};

const serializeComment = (comment, viewerUserId = null) => {
  const raw = comment.toObject ? comment.toObject() : comment;
  const user = raw.user && typeof raw.user === 'object' ? raw.user : null;
  return {
    id: toId(raw._id || raw.id),
    text: raw.text,
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : null,
    user: user ? { id: toId(user._id || user.id), name: user.name, username: user.username, avatar: user.avatar } : null,
    mine: Boolean(viewerUserId && user && toId(user._id || user.id) === String(viewerUserId)),
  };
};

const createToken = (user) =>
  jwt.sign({ id: toId(user._id || user.id), email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });

const seedUsers = [
  {
    name: 'Mila Hart',
    username: 'mila',
    email: 'mila@inkflow.io',
    password: bcrypt.hashSync('password123', 10),
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80',
    bio: 'Writer, editor and collector of quiet stories.',
    role: 'creator',
    bookmarks: [],
  },
  {
    name: 'Ari Stone',
    username: 'ari',
    email: 'ari@inkflow.io',
    password: bcrypt.hashSync('password123', 10),
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80',
    bio: 'Travel notes and design experiments on every coast.',
    role: 'creator',
    bookmarks: [],
  },
  {
    name: 'Jude Park',
    username: 'jude',
    email: 'reader@inkflow.io',
    password: bcrypt.hashSync('password123', 10),
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80',
    bio: 'A curious reader with an obsession for Product, design and craft.',
    role: 'reader',
    bookmarks: [],
  },
  {
    name: 'Inkflow Admin',
    username: 'admin',
    email: 'admin@inkflow.io',
    password: bcrypt.hashSync('admin123', 10),
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=800&q=80',
    bio: 'Platform safety and community care.',
    role: 'admin',
    bookmarks: [],
  },
];

const seedBlogData = [
  {
    title: 'Designing a slower, better morning routine',
    slug: 'designing-a-slower-better-morning-routine',
    author: 'mila',
    content:
      '<p>Most productivity advice asks for speed. I wanted calm instead.</p><p>My mornings became easier when I stopped chasing a perfect routine and started building one that matched my energy. The first shift was reducing the number of decisions I made before coffee. I chose one outfit, one breakfast, and one queue of tasks.</p><p>Then I let the quieter parts of the routine matter: fifteen minutes with sunlight, a short walk, and no notifications until the day was truly awake.</p><p>That rhythm gave me more focus than a packed schedule ever did.</p>',
    excerpt: 'A gentle framework for creating a morning routine that feels sustainable instead of frantic.',
    coverImage: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    category: 'Productivity',
    tags: ['habits', 'focus', 'wellbeing'],
    status: 'published',
    publishedAt: '2025-10-20T08:30:00.000Z',
    views: 1823,
    readTime: 4,
  },
  {
    title: 'Three coastal ideas for a creative reset',
    slug: 'three-coastal-ideas-for-a-creative-reset',
    author: 'ari',
    content:
      '<p>Creative work gets louder when we stay indoors too long.</p><p>I have started seeking a reset in open spaces: walking the waterfront before meetings, writing in a quiet café, and letting the wide horizon decide the pace.</p><p>Even small changes help. Move a walk into the middle of the day. Sit near a window. Keep a notebook ready for half-formed ideas that deserve a second look.</p><p>When the environment changes, the mind loosens up.</p>',
    excerpt: 'Three humble ways to change your environment and bring back creative momentum.',
    coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    category: 'Creativity',
    tags: ['travel', 'design', 'inspiration'],
    status: 'published',
    publishedAt: '2025-10-25T13:00:00.000Z',
    views: 1210,
    readTime: 5,
  },
  {
    title: 'Why soft launch moments matter more than big reveals',
    slug: 'why-soft-launch-moments-matter-more-than-big-reveals',
    author: 'mila',
    content:
      '<p>Big launches are memorable, but they are rarely the entire story.</p><p>What makes a product feel real is the way it earns trust one small, honest moment at a time. A soft launch gives you room to learn.</p><p>You hear the real friction. You identify the tiny questions people ask. You give your users time to feel the experience before it becomes a headline.</p><p>That is often the difference between a launch that works and one that merely looks impressive.</p>',
    excerpt: 'Soft launches create room for clarity, user feedback, and a stronger final release.',
    coverImage: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    category: 'Startups',
    tags: ['launch', 'strategy', 'product'],
    status: 'draft',
    publishedAt: null,
    views: 0,
    readTime: 4,
  },
  {
    title: 'A field guide to reading better in public',
    slug: 'a-field-guide-to-reading-better-in-public',
    author: 'ari',
    content:
      '<p>Reading in public is a skill worth learning.</p><p>Whether you are in a café, on the train, or between meetings, a good reading ritual can make the day feel more deliberate.</p><p>I keep one book in my tote, one note card in my pocket, and a small intention before I sit down: what am I letting myself notice today?</p><p>That kind of attention is a quiet luxury.</p>',
    excerpt: 'A practical way to make reading a ritual instead of a task.',
    coverImage: 'https://images.unsplash.com/photo-1516979187454-437ec7b4d90d?auto=format&fit=crop&w=1200&q=80',
    category: 'Culture',
    tags: ['books', 'reading', 'routine'],
    status: 'published',
    publishedAt: '2025-10-15T07:30:00.000Z',
    views: 950,
    readTime: 3,
  },
  {
    title: 'The small rituals that make creative work sustainable',
    slug: 'the-small-rituals-that-make-creative-work-sustainable',
    author: 'mila',
    content:
      '<p>Creative life is rarely powered by heroics. It is powered by the repeated rituals that keep attention alive.</p><p>The best routines are not always impressive. They are often boring in the most useful way: open your notes, write for twenty minutes, put the phone in another room, review one idea before lunch.</p><p>That rhythm creates a healthier creative practice than waiting for inspiration to arrive on demand.</p><p>The goal is not intensity. It is continuity.</p>',
    excerpt: 'A reminder that durable creative work comes from consistent rituals, not bursts of intensity.',
    coverImage: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80',
    category: 'Wellbeing',
    tags: ['rituals', 'creativity', 'focus'],
    status: 'published',
    publishedAt: '2025-10-12T09:00:00.000Z',
    views: 1460,
    readTime: 4,
  },
  {
    title: 'What I learned from building a tiny writing habit',
    slug: 'what-i-learned-from-building-a-tiny-writing-habit',
    author: 'mila',
    content:
      '<p>I once believed writing only mattered when I had a big idea.</p><p>That was a trap. The real magic happened in the small acts: a sentence before breakfast, a note on the commute, a paragraph written before the meeting room got noisy.</p><p>These fragments built trust with myself. They made writing a daily practice instead of an occasional performance.</p><p>Now I protect the small habit more than the perfect draft.</p>',
    excerpt: 'How tiny daily writing sessions create a resilient creative practice over time.',
    coverImage: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80',
    category: 'Productivity',
    tags: ['writing', 'practice', 'discipline'],
    status: 'published',
    publishedAt: '2025-10-04T12:15:00.000Z',
    views: 1120,
    readTime: 3,
  },
  {
    title: 'Designing for slower decision making',
    slug: 'designing-for-slower-decision-making',
    author: 'ari',
    content:
      '<p>Most product teams are optimizing for pace. I think the better goal is clarity.</p><p>Slow decision making is not the same as indecision. It is letting a problem mature before forcing a solution. That often means asking better questions and sharing fewer but stronger signals.</p><p>When teams learn to pause, they start noticing what actually matters and what can be left alone.</p><p>Speed without clarity just creates expensive noise.</p>',
    excerpt: 'A product lens on why better decisions often come from slower, calmer thinking.',
    coverImage: 'https://images.unsplash.com/photo-1516321165247-4aa89a48be28?auto=format&fit=crop&w=1200&q=80',
    category: 'Design',
    tags: ['product', 'ux', 'systems'],
    status: 'published',
    publishedAt: '2025-09-29T08:45:00.000Z',
    views: 980,
    readTime: 5,
  },
  {
    title: 'A city notebook for noticing better',
    slug: 'a-city-notebook-for-noticing-better',
    author: 'ari',
    content:
      '<p>There is a kind of attention that only appears when you really look.</p><p>On city walks, I have started carrying a notebook and making a rule: no list of tasks, just observations. A window that catches the sun. A stranger reading with both hands. A bakery smell that changes the whole street.</p><p>The result is simple but powerful. I remember the day with more texture.</p><p>Noticing is a form of generosity to yourself.</p>',
    excerpt: 'How a city notebook can sharpen attention and make everyday life more vivid.',
    coverImage: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80',
    category: 'Culture',
    tags: ['travel', 'notes', 'attention'],
    status: 'published',
    publishedAt: '2025-09-18T15:20:00.000Z',
    views: 760,
    readTime: 4,
  },
  {
    title: 'Why meaningful work usually starts as a tiny experiment',
    slug: 'why-meaningful-work-usually-starts-as-a-tiny-experiment',
    author: 'mila',
    content:
      '<p>Big projects feel intimidating because they are so visible.</p><p>But most worthwhile work begins as a small test: one email, one landing page, one draft, one experiment with a new idea. The goal is not perfection. It is learning what deserves more time.</p><p>When we let ourselves start small, we stop protecting our ego and start building momentum.</p><p>That is where real work usually begins.</p>',
    excerpt: 'A practical argument for starting with small, honest experiments before chasing a full vision.',
    coverImage: 'https://images.unsplash.com/photo-1522204523234-8729aa6e3d5f?auto=format&fit=crop&w=1200&q=80',
    category: 'Startups',
    tags: ['experiments', 'work', 'growth'],
    status: 'draft',
    publishedAt: null,
    views: 0,
    readTime: 4,
  },
];

const seedComments = [
  {
    text: 'This felt like a warm conversation with a notebook. Loved the practical advice.',
    createdAt: '2025-11-02T09:15:00.000Z',
  },
  {
    text: 'The pacing and mood are excellent. It made me want to travel again.',
    createdAt: '2025-11-01T14:20:00.000Z',
  },
];

const ensureSeedData = async () => {
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const createdUsers = await User.insertMany(seedUsers);
    const userMap = Object.fromEntries(createdUsers.map((user) => [user.username, user._id]));
    const blogsToInsert = seedBlogData.map((blog) => ({
      ...blog,
      author: userMap[blog.author || 'mila'],
      excerpt: blog.excerpt || formatExcerpt(blog.content),
      readTime: blog.readTime || readTime(blog.content),
      likes: [],
    }));

    const createdBlogs = await Blog.insertMany(blogsToInsert);
    const blogMap = Object.fromEntries(createdBlogs.map((blog) => [blog.slug, blog._id]));

    const commentEntries = [
      { blog: blogMap['designing-a-slower-better-morning-routine'], user: userMap.jude, text: seedComments[0].text, createdAt: seedComments[0].createdAt },
      { blog: blogMap['three-coastal-ideas-for-a-creative-reset'], user: userMap.mila, text: seedComments[1].text, createdAt: seedComments[1].createdAt },
    ];

    await Comment.insertMany(commentEntries);

    const mila = await User.findOne({ username: 'mila' });
    const user2 = await User.findOne({ username: 'ari' });
    const jude = await User.findOne({ username: 'jude' });

    if (mila) {
      const blog1 = await Blog.findOne({ slug: 'designing-a-slower-better-morning-routine' });
      const blog3 = await Blog.findOne({ slug: 'why-soft-launch-moments-matter-more-than-big-reveals' });
      mila.bookmarks = blog1 ? [blog1._id] : [];
      if (blog3) mila.bookmarks = [...new Set([...mila.bookmarks, blog3._id])];
      await mila.save();
    }

    if (user2) {
      const blog2 = await Blog.findOne({ slug: 'three-coastal-ideas-for-a-creative-reset' });
      if (blog2) {
        user2.bookmarks = [blog2._id];
        await user2.save();
      }
    }

    if (jude) {
      const blog1 = await Blog.findOne({ slug: 'designing-a-slower-better-morning-routine' });
      if (blog1) {
        jude.bookmarks = [blog1._id];
        await jude.save();
      }
    }

    const blogOne = await Blog.findOne({ slug: 'designing-a-slower-better-morning-routine' });
    const blogFour = await Blog.findOne({ slug: 'a-field-guide-to-reading-better-in-public' });
    if (blogOne) {
      blogOne.likes = [userMap.ari, userMap.jude];
      await blogOne.save();
    }
    if (blogFour) {
      blogFour.likes = [userMap.mila, userMap.jude];
      await blogFour.save();
    }
  }
};

const connectToDatabase = async () => {
  if (mongoose.connection.readyState) {
    return;
  }

  const mongoUri = await getMongoConnectionString();
  await mongoose.connect(mongoUri, { dbName: 'inkflow-blog' });
  console.log(`Connected to MongoDB: ${mongoUri}`);
};

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
  process.env.CLIENT_URL,
].filter(Boolean));

const isDevOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;

  const normalized = origin.replace(/\/$/, '');
  const localhostMatch = /^http:\/\/(localhost|127\.0\.0\.1):517[3-9]$/.test(normalized);
  return localhostMatch || /^http:\/\/localhost:5[1-9][0-9]{2}$/.test(normalized);
};

app.use(
  cors({
    origin(origin, callback) {
      if (isDevOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS origin not allowed'));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

const authMiddleware = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    User.findById(decoded.id)
      .then((user) => {
        if (!user) {
          return res.status(401).json({ message: 'Invalid session.' });
        }
        req.user = user;
        return next();
      })
      .catch(() => res.status(401).json({ message: 'Session expired.' }));
  } catch {
    return res.status(401).json({ message: 'Session expired.' });
  }
};

const creatorOnly = (req, res, next) => {
  if (req.user.role !== 'creator' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Creator access required.' });
  }
  next();
};

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', name: 'Inkflow API' });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required.' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'An account with that email already exists.' });
  }

  const normalizedRole = role === 'reader' || role === 'admin' ? role : 'creator';
  const usernameValue = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'reader'}-${Date.now().toString().slice(-4)}`;
  const newUser = await User.create({
    name,
    username: usernameValue,
    email: email.toLowerCase(),
    password: bcrypt.hashSync(password, 10),
    avatar: 'https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=800&q=80',
    bio: 'New to Inkflow and ready to tell a story.',
    role: normalizedRole,
    bookmarks: [],
  });

  const token = createToken(newUser);
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: false });
  return res.status(201).json({ user: serializeUser(newUser), message: 'Account created successfully.' });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const token = createToken(user);
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: false });
  return res.json({ user: serializeUser(user), message: 'Welcome back.' });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'Logged out successfully.' });
});

app.get('/api/auth/me', async (req, res) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Session invalid.' });
    }
    return res.json({ user: serializeUser(user) });
  } catch {
    return res.status(401).json({ message: 'Session invalid.' });
  }
});

app.put('/api/users/me', authMiddleware, async (req, res) => {
  const { name, bio, avatar } = req.body;
  const user = await User.findById(req.user._id || req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  user.name = name || user.name;
  user.bio = bio || user.bio;
  if (avatar) user.avatar = avatar;
  await user.save();

  return res.json({ user: serializeUser(user), message: 'Profile updated.' });
});

app.put('/api/users/become-creator', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user._id || req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (user.role === 'reader') {
    user.role = 'creator';
    await user.save();
    return res.json({ user: serializeUser(user), message: 'Creator access granted.' });
  }

  return res.json({ user: serializeUser(user), message: 'Already a creator.' });
});

app.get('/api/users/:username', async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) {
    return res.status(404).json({ message: 'Creator not found.' });
  }

  const blogs = await Blog.find({ author: user._id, status: 'published' }).populate('author');
  const currentUserId = req.cookies?.token ? jwt.decode(req.cookies.token)?.id : null;

  return res.json({
    user: {
      ...serializeUser(user),
      blogs: blogs.map((blog) => serializeBlog(blog, currentUserId)),
    },
    blogs: blogs.map((blog) => serializeBlog(blog, currentUserId)),
  });
});

app.get('/api/blogs', async (req, res) => {
  const { search = '', category = '', sort = 'latest', page = 1 } = req.query;
  const query = { status: 'published' };

  if (search) {
    const term = search.toLowerCase();
    query.$or = [
      { title: { $regex: term, $options: 'i' } },
      { category: { $regex: term, $options: 'i' } },
      { tags: { $in: [new RegExp(term, 'i')] } },
    ];
  }

  if (category && category !== 'all') {
    query.category = category;
  }

  const sortMap = {
    latest: { publishedAt: -1 },
    liked: { likes: -1 },
    popular: { views: -1 },
  };

  const currentPage = Number(page) || 1;
  const pageSize = 6;
  const total = await Blog.countDocuments(query);
  const blogs = await Blog.find(query)
    .populate('author')
    .sort(sortMap[sort] || sortMap.latest)
    .skip((currentPage - 1) * pageSize)
    .limit(pageSize);

  const tokenUserId = req.cookies?.token ? jwt.decode(req.cookies.token)?.id : null;
  return res.json({
    blogs: blogs.map((blog) => serializeBlog(blog, tokenUserId)),
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    page: currentPage,
    total,
  });
});

app.get('/api/blogs/mine', authMiddleware, creatorOnly, async (req, res) => {
  const blogs = await Blog.find({ author: req.user._id || req.user.id }).populate('author').sort({ createdAt: -1 });
  return res.json({ blogs: blogs.map((blog) => serializeBlog(blog, req.user._id || req.user.id)) });
});

app.get('/api/blogs/:slug', async (req, res) => {
  const blog = await Blog.findOne({ slug: req.params.slug, status: 'published' }).populate('author');
  if (!blog) {
    return res.status(404).json({ message: 'Blog not found.' });
  }

  blog.views = (blog.views || 0) + 1;
  await blog.save();

  const currentUserId = req.cookies?.token ? jwt.decode(req.cookies.token)?.id : null;
  const comments = await Comment.find({ blog: blog._id }).populate('user', 'name username avatar').sort({ createdAt: -1 });

  return res.json({
    blog: {
      ...serializeBlog(blog, currentUserId),
      comments: comments.map((comment) => serializeComment(comment, currentUserId)),
    },
  });
});

app.post('/api/blogs', authMiddleware, creatorOnly, async (req, res) => {
  const { title, content, category, tags = [], coverImage, status = 'draft' } = req.body;
  const cleanedTags = Array.isArray(tags) ? tags.map((tag) => String(tag).trim()).filter(Boolean) : [];

  if (!title || !content || !category || cleanedTags.length === 0 || !coverImage || !String(coverImage).trim()) {
    return res.status(400).json({ message: 'Title, story, category, at least one tag and a cover image are required.' });
  }

  const slug = `${buildSlug(title)}-${Date.now().toString().slice(-5)}`;
  const blog = await Blog.create({
    title,
    slug,
    content,
    excerpt: formatExcerpt(content),
    coverImage: String(coverImage).trim(),
    category,
    tags: cleanedTags,
    author: req.user._id || req.user.id,
    status,
    publishedAt: status === 'published' ? new Date().toISOString() : null,
    likes: [],
    views: 0,
    readTime: readTime(content),
  });

  const hydrated = await Blog.findById(blog._id).populate('author');
  return res.status(201).json({ blog: serializeBlog(hydrated, req.user._id || req.user.id) });
});

app.put('/api/blogs/:id', authMiddleware, async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) {
    return res.status(404).json({ message: 'Blog not found.' });
  }

  const ownerId = toId(blog.author);
  if (ownerId !== String(req.user._id || req.user.id) && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'You can only edit your own blog.' });
  }

  const { title, content, category, tags = [], coverImage, status } = req.body;
  const cleanedTags = Array.isArray(tags) ? tags.map((tag) => String(tag).trim()).filter(Boolean) : [];

  if (title) blog.title = title;
  if (content) {
    blog.content = content;
    blog.excerpt = formatExcerpt(content);
    blog.readTime = readTime(content);
  }
  if (category) blog.category = category;
  if (tags) blog.tags = cleanedTags;
  if (coverImage) blog.coverImage = String(coverImage).trim();
  if (status) {
    blog.status = status;
    blog.publishedAt = status === 'published' ? blog.publishedAt || new Date() : blog.publishedAt;
  }
  if (title) {
    blog.slug = `${buildSlug(title)}-${Date.now().toString().slice(-5)}`;
  }

  if (!blog.title || !blog.content || !blog.category || blog.tags.length === 0 || !blog.coverImage || !String(blog.coverImage).trim()) {
    return res.status(400).json({ message: 'Title, story, category, at least one tag and a cover image are required.' });
  }

  await blog.save();
  const hydrated = await Blog.findById(blog._id).populate('author');
  return res.json({ blog: serializeBlog(hydrated, req.user._id || req.user.id) });
});

app.delete('/api/blogs/:id', authMiddleware, async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) {
    return res.status(404).json({ message: 'Blog not found.' });
  }

  const ownerId = toId(blog.author);
  if (ownerId !== String(req.user._id || req.user.id) && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'You can only delete your own blog.' });
  }

  await Comment.deleteMany({ blog: blog._id });
  await blog.deleteOne();
  return res.json({ message: 'Blog deleted successfully.' });
});

app.post('/api/blogs/:id/like', authMiddleware, async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) {
    return res.status(404).json({ message: 'Blog not found.' });
  }

  const userId = req.user._id || req.user.id;
  const hasLiked = blog.likes.some((id) => String(id) === String(userId));
  if (hasLiked) {
    blog.likes = blog.likes.filter((id) => String(id) !== String(userId));
  } else {
    blog.likes.push(userId);
  }

  await blog.save();
  return res.json({ liked: !hasLiked, likesCount: blog.likes.length });
});

app.post('/api/blogs/:id/bookmark', authMiddleware, async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) {
    return res.status(404).json({ message: 'Blog not found.' });
  }

  const user = await User.findById(req.user._id || req.user.id);
  const blogId = String(blog._id);
  const alreadySaved = user.bookmarks.some((item) => String(item) === blogId);

  user.bookmarks = alreadySaved
    ? user.bookmarks.filter((item) => String(item) !== blogId)
    : [...user.bookmarks, blog._id];

  await user.save();
  return res.json({ bookmarked: !alreadySaved, bookmarks: user.bookmarks.map((bookmark) => String(bookmark)) });
});

app.get('/api/users/me/bookmarks', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user._id || req.user.id).populate({ path: 'bookmarks', populate: 'author' });
  const blogs = user.bookmarks.filter((blog) => blog.status === 'published');
  return res.json({ blogs: blogs.map((blog) => serializeBlog(blog, req.user._id || req.user.id)) });
});

app.get('/api/blogs/:id/comments', async (req, res) => {
  const currentUserId = req.cookies?.token ? jwt.decode(req.cookies.token)?.id : null;
  const comments = await Comment.find({ blog: req.params.id }).populate('user', 'name username avatar').sort({ createdAt: -1 });
  return res.json({ comments: comments.map((comment) => serializeComment(comment, currentUserId)) });
});

app.post('/api/blogs/:id/comments', authMiddleware, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ message: 'Comment text is required.' });
  }

  const comment = await Comment.create({
    blog: req.params.id,
    user: req.user._id || req.user.id,
    text: text.trim(),
  });

  const hydrated = await Comment.findById(comment._id).populate('user', 'name username avatar');
  return res.status(201).json({ comment: serializeComment(hydrated, req.user._id || req.user.id) });
});

app.delete('/api/comments/:id', authMiddleware, async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) {
    return res.status(404).json({ message: 'Comment not found.' });
  }

  if (String(comment.user) !== String(req.user._id || req.user.id) && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'You can only delete your own comment.' });
  }

  await comment.deleteOne();
  return res.json({ message: 'Comment deleted.' });
});

app.post('/api/upload', authMiddleware, creatorOnly, (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ message: 'Image data is required.' });
  }

  return res.json({ url: image || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=80' });
});

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found.` });
});

const startServer = async () => {
  if (mongoose.connection.readyState !== 0) {
    return;
  }

  await connectToDatabase();
  await ensureSeedData();
};

export { app, startServer };

const isDirectExecution = () => {
  if (!process.argv[1]) return false;

  const scriptPath = fileURLToPath(import.meta.url);
  const resolvedScript = pathToFileURL(scriptPath).href;
  const resolvedArg = pathToFileURL(process.argv[1]).href;
  return resolvedScript === resolvedArg;
};

if (isDirectExecution()) {
  startServer()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Inkflow API listening on http://localhost:${PORT}`);
      });
    })
    .catch((error) => {
      console.error('Failed to start Inkflow server', error);
      process.exit(1);
    });
}
