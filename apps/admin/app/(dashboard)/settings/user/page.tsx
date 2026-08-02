"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";

const userFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  website: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

export default function UserSettingsPage() {
  const { user } = useSession();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [profileImage, setProfileImage] = React.useState<string | null>(null);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      firstName: user?.name?.split(" ")[0] ?? "Admin",
      lastName: user?.name?.split(" ").slice(1).join(" ") ?? "User",
      email: user?.email ?? "admin@hero.test",
      phone: "",
      website: "",
      location: "San Francisco, CA",
      bio: "Administrator account managing marketplace services and user operations.",
      timezone: "utc",
      language: "english",
    },
  });

  React.useEffect(() => {
    if (user) {
      const parts = (user.name ?? "Admin User").split(" ");
      form.reset({
        firstName: parts[0] || "Admin",
        lastName: parts.slice(1).join(" ") || "User",
        email: user.email || "admin@hero.test",
        phone: "",
        website: "",
        location: "San Francisco, CA",
        bio: "Administrator account managing marketplace services and user operations.",
        timezone: "utc",
        language: "english",
      });
    }
  }, [user, form]);

  function onSubmit(data: UserFormValues) {
    toast.success(`Profile settings saved for ${data.firstName} ${data.lastName}`);
  }

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileImage(e.target?.result as string);
        toast.info("Avatar updated preview");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReset = () => {
    setProfileImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Account Profile"
        description="Update your administrator profile information and account preferences."
      />

      <div className="px-4 lg:px-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Card className="shadow-xs">
              <CardHeader>
                <CardTitle>Profile Details</CardTitle>
                <CardDescription>
                  Personal information displayed across your administrator workspace
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Profile Picture Section */}
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20 rounded-lg">
                    <AvatarImage src={profileImage || user?.avatar || undefined} />
                    <AvatarFallback className="rounded-lg font-bold text-lg">
                      {user?.name ? user.name.slice(0, 2).toUpperCase() : "AD"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={handleFileUpload}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload new photo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                      >
                        Reset
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Allowed JPG, GIF or PNG. Maximum file size of 800KB
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/gif,image/png"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                <Separator />

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="First name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Last name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="+1 (555) 000-0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="City, Country" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Language</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select Language" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="english">English</SelectItem>
                            <SelectItem value="spanish">Spanish</SelectItem>
                            <SelectItem value="french">French</SelectItem>
                            <SelectItem value="german">German</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Administrator Bio</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of admin responsibilities..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-start gap-3">
                  <Button type="submit">Save Changes</Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => form.reset()}
                  >
                    Reset Form
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>
    </div>
  );
}
