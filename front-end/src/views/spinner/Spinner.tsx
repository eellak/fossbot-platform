import { FC } from 'react';
import './spinner.css';

type SpinnerMarkProps = {
  compact?: boolean;
};

export const SpinnerMark: FC<SpinnerMarkProps> = ({ compact = false }) => (
  <div className={`loading component-loader${compact ? ' compact-loader' : ''}`}>
    <div className="effect-1 effects" />
    <div className="effect-2 effects" />
    <div className="effect-3 effects" />
  </div>
);

const Spinner: FC = () => (
  <div className="fallback-spinner">
    <SpinnerMark />
  </div>
);
export default Spinner;
