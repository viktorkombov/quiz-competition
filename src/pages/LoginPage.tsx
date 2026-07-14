import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate, useNavigate } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { repository } from '@/data'
import { DEMO_ADMIN } from '@/data/seed'
import { loginSchema, signUpSchema, type LoginValues, type SignUpValues } from '@/lib/validation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LocalModeBanner } from '@/components/LocalModeBanner'
import { useToast } from '@/components/ui/use-toast'

export function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [tab, setTab] = React.useState('login')

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: repository.isLocal ? DEMO_ADMIN.email : '', password: '' },
  })
  const signUpForm = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', displayName: '' },
  })

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  const onLogin = loginForm.handleSubmit(async (values) => {
    try {
      await signIn(values.email, values.password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Неуспешно влизане',
        description: err instanceof Error ? err.message : 'Опитайте отново.',
      })
    }
  })

  const onSignUp = signUpForm.handleSubmit(async (values) => {
    try {
      await signUp(values.email, values.password, values.displayName)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Неуспешна регистрация',
        description: err instanceof Error ? err.message : 'Опитайте отново.',
      })
    }
  })

  return (
    <div className="flex min-h-screen flex-col">
      <LocalModeBanner />
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Trophy className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Куиз състезание</h1>
              <p className="text-sm text-muted-foreground">
                Платформа за организатори на куиз вечери
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Достъп за администратори</CardTitle>
              <CardDescription>Влезте, за да управлявате своите игри.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Вход</TabsTrigger>
                  <TabsTrigger value="signup">Регистрация</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={onLogin} className="space-y-4" noValidate>
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Имейл</Label>
                      <Input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        {...loginForm.register('email')}
                        aria-invalid={!!loginForm.formState.errors.email}
                      />
                      {loginForm.formState.errors.email && (
                        <p className="text-sm text-destructive">
                          {loginForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Парола</Label>
                      <Input
                        id="login-password"
                        type="password"
                        autoComplete="current-password"
                        {...loginForm.register('password')}
                        aria-invalid={!!loginForm.formState.errors.password}
                      />
                      {loginForm.formState.errors.password && (
                        <p className="text-sm text-destructive">
                          {loginForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting}>
                      {loginForm.formState.isSubmitting ? 'Влизане…' : 'Вход'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={onSignUp} className="space-y-4" noValidate>
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Име за показване</Label>
                      <Input id="signup-name" {...signUpForm.register('displayName')} />
                      {signUpForm.formState.errors.displayName && (
                        <p className="text-sm text-destructive">
                          {signUpForm.formState.errors.displayName.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Имейл</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        autoComplete="email"
                        {...signUpForm.register('email')}
                      />
                      {signUpForm.formState.errors.email && (
                        <p className="text-sm text-destructive">
                          {signUpForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Парола</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        autoComplete="new-password"
                        {...signUpForm.register('password')}
                      />
                      {signUpForm.formState.errors.password && (
                        <p className="text-sm text-destructive">
                          {signUpForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={signUpForm.formState.isSubmitting}>
                      {signUpForm.formState.isSubmitting ? 'Създаване…' : 'Създай профил'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {repository.isLocal && (
                <p className="mt-4 rounded-md bg-muted p-3 text-center text-xs text-muted-foreground">
                  Демо достъп: <strong>{DEMO_ADMIN.email}</strong> / парола{' '}
                  <strong>{DEMO_ADMIN.password}</strong>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
