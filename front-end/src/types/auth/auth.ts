export interface registerType {
    title?: string;
    subtitle?: JSX.Element | JSX.Element[];
    subtext?: JSX.Element | JSX.Element[];
    onShowSuccessAlert: (message: string) => void;
    onShowErrorAlert: (message: string) => void;
  }
  
  export interface loginType {
    title?: string;
    subtitle?: JSX.Element | JSX.Element[];
    subtext?: JSX.Element | JSX.Element[];
    handleShowErrorAlert: (message: string) => void;
  }
  
  export interface signInType {
    title?: string;
  }
  