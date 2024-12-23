export const styles = {
  dialog: "sm:max-w-[425px]",
  tabContainer: "flex space-x-2 border-b border-border mb-6",
  tab: `
    flex-1 pb-3 text-sm font-medium text-muted-foreground 
    hover:text-foreground transition-colors
    border-b-2 border-transparent
  `,
  activeTab: "text-foreground border-primary",
  description: "text-center text-muted-foreground mt-2",
  formContainer: "space-y-6",
  form: "space-y-4",
  inputGroup: "space-y-2",
  forgotPassword: "text-sm px-0 h-auto font-normal",
  submitButton: `
    w-full bg-gradient-to-r from-purple-600 to-pink-600 
    hover:from-purple-700 hover:to-pink-700 
    text-white shadow-lg hover:shadow-purple-500/50 
    transition-all duration-300
  `,
  googleButton: "border-2",
  divider: "relative flex items-center",
  dividerLine: "flex-grow border-t border-border",
  dividerText: "px-3 text-sm text-muted-foreground"
} as const;
