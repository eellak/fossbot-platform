import { Helmet } from 'react-helmet';

type Props = {
  description?: string;
  children: JSX.Element | JSX.Element[];
  title?: string;
};

const PageContainer = ({ title, description, children }: Props) => {
  const pathname = window.location.pathname.slice(1); // Remove leading '/'

  return (
    <div id={pathname}>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
      </Helmet>
      {children}
    </div>
  );
};

export default PageContainer;
