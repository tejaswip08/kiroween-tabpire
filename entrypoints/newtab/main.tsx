import { createRoot } from 'react-dom/client';
import '../../components/theme.css';

import './crypt.css';
import { Crypt } from './Crypt';

createRoot(document.getElementById('root')!).render(<Crypt />);
