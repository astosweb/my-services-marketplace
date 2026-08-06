export function SiteFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex flex-col items-center justify-center text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Gobid Admin
          </p>
        </div>
      </div>
    </footer>
  )
}
