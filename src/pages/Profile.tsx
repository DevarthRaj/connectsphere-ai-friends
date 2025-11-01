import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Loader2, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

const Profile = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    username: "",
    avatar_url: "",
    banner_url: "",
    github_link: "",
    linkedin_link: "",
    bio: "",
  });

  const [errors, setErrors] = useState({
    github_link: "",
    linkedin_link: "",
    bio: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) {
        toast({
          title: "Error",
          description: "Failed to load profile",
          variant: "destructive",
        });
      } else if (data) {
        setProfile(data);
        setFormData({
          username: data.username || "",
          avatar_url: data.avatar_url || "",
          banner_url: data.banner_url || "",
          github_link: data.github_link || "",
          linkedin_link: data.linkedin_link || "",
          bio: data.bio || "",
        });
      }

      setLoading(false);
    };

    fetchProfile();
  }, [navigate, toast]);

  const validateGithubLink = (url: string): boolean => {
    if (!url) return true;
    const regex = /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]+\/?$/;
    return regex.test(url);
  };

  const validateLinkedinLink = (url: string): boolean => {
    if (!url) return true;
    const regex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?$/;
    return regex.test(url);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Validate on change
    if (field === "github_link") {
      setErrors((prev) => ({
        ...prev,
        github_link: validateGithubLink(value)
          ? ""
          : "Invalid GitHub URL format. Example: https://github.com/username",
      }));
    }

    if (field === "linkedin_link") {
      setErrors((prev) => ({
        ...prev,
        linkedin_link: validateLinkedinLink(value)
          ? ""
          : "Invalid LinkedIn URL format. Example: https://linkedin.com/in/username",
      }));
    }

    if (field === "bio") {
      setErrors((prev) => ({
        ...prev,
        bio: value.length > 500 ? "Bio must be 500 characters or less" : "",
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const githubValid = validateGithubLink(formData.github_link);
    const linkedinValid = validateLinkedinLink(formData.linkedin_link);
    const bioValid = formData.bio.length <= 500;

    if (!githubValid || !linkedinValid || !bioValid) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        username: formData.username,
        avatar_url: formData.avatar_url || null,
        banner_url: formData.banner_url || null,
        github_link: formData.github_link || null,
        linkedin_link: formData.linkedin_link || null,
        bio: formData.bio || null,
      })
      .eq("id", user?.id);

    setSaving(false);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5">
      <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Edit Profile
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={formData.avatar_url} />
                <AvatarFallback>
                  <UserIcon className="h-10 w-10" />
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your profile details and social links
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                  required
                  minLength={3}
                  maxLength={30}
                  pattern="^[a-zA-Z0-9_]+$"
                  placeholder="your_username"
                />
                <p className="text-xs text-muted-foreground">
                  3-30 characters, letters, numbers, and underscores only
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar_url">Avatar URL</Label>
                <Input
                  id="avatar_url"
                  type="url"
                  value={formData.avatar_url}
                  onChange={(e) => handleInputChange("avatar_url", e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                />
                <p className="text-xs text-muted-foreground">
                  URL to your profile picture
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="banner_url">Banner URL</Label>
                <Input
                  id="banner_url"
                  type="url"
                  value={formData.banner_url}
                  onChange={(e) => handleInputChange("banner_url", e.target.value)}
                  placeholder="https://example.com/banner.jpg"
                />
                <p className="text-xs text-muted-foreground">
                  URL to your profile banner (image or video)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="github_link">GitHub Profile</Label>
                <Input
                  id="github_link"
                  type="url"
                  value={formData.github_link}
                  onChange={(e) => handleInputChange("github_link", e.target.value)}
                  placeholder="https://github.com/username"
                  className={errors.github_link ? "border-destructive" : ""}
                />
                {errors.github_link && (
                  <p className="text-xs text-destructive">{errors.github_link}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedin_link">LinkedIn Profile</Label>
                <Input
                  id="linkedin_link"
                  type="url"
                  value={formData.linkedin_link}
                  onChange={(e) => handleInputChange("linkedin_link", e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className={errors.linkedin_link ? "border-destructive" : ""}
                />
                {errors.linkedin_link && (
                  <p className="text-xs text-destructive">{errors.linkedin_link}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => handleInputChange("bio", e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={4}
                  maxLength={500}
                  className={errors.bio ? "border-destructive" : ""}
                />
                <div className="flex justify-between items-center">
                  <p className="text-xs text-muted-foreground">
                    {formData.bio.length}/500 characters
                  </p>
                  {errors.bio && (
                    <p className="text-xs text-destructive">{errors.bio}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={saving || Object.values(errors).some(e => e !== "")}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate("/")}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;