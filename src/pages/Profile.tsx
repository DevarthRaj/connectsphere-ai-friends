import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Loader2, User as UserIcon, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

const Profile = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

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

  // 1. FETCH DATA ON PAGE LOAD
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user); // User is set here

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, username, avatar_url, banner_url, github_link, linkedin_link, bio"
        )
        .eq("id", session.user.id)
        .maybeSingle(); // Use maybeSingle() to prevent 0-row error

      if (error) {
        console.error("Error fetching profile:", error);
        toast({ title: "Error", description: "Failed to load profile. " + error.message, variant: "destructive" });
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

  // 2. VALIDATE TEXT INPUTS
  const validateGithubLink = (url: string): boolean => {
    if (!url) return true;
    const regex = /^https:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]+(\/)?$/;
    return regex.test(url);
  };

  const validateLinkedinLink = (url: string): boolean => {
    if (!url) return true;
    const regex = /^https:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+(\/)?$/;
    return regex.test(url);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    if (field === "github_link") {
      setErrors((prev) => ({ ...prev, github_link: validateGithubLink(value) ? "" : "Invalid GitHub URL." }));
    }
    if (field === "linkedin_link") {
      setErrors((prev) => ({ ...prev, linkedin_link: validateLinkedinLink(value) ? "" : "Invalid LinkedIn URL." }));
    }
    if (field === "bio") {
      setErrors((prev) => ({ ...prev, bio: value.length > 300 ? "Bio must be 300 characters or less" : "" }));
    }
  };

  // 3. NEW FILE UPLOAD LOGIC
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    if (!event.target.files || event.target.files.length === 0 || !user) {
      toast({ title: "Error", description: "You must be logged in to upload files.", variant: "destructive" });
      return;
    }

    const file = event.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    if (type === 'avatar') setUploadingAvatar(true);
    if (type === 'banner') setUploadingBanner(true);

    const { error: uploadError } = await supabase.storage
      .from(type === 'avatar' ? 'avatars' : 'banners')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload Error", description: uploadError.message, variant: "destructive" });
      setUploadingAvatar(false);
      setUploadingBanner(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from(type === 'avatar' ? 'avatars' : 'banners')
      .getPublicUrl(filePath);

    if (!publicUrlData) {
      toast({ title: "Error", description: "Could not get public URL for the image.", variant: "destructive" });
      setUploadingAvatar(false);
      setUploadingBanner(false);
      return;
    }

    const newUrl = publicUrlData.publicUrl;
    const fieldName = type === 'avatar' ? 'avatar_url' : 'banner_url';
    
    // === THIS IS THE ONLY THING THAT HAPPENS === //
    // Update the local form data to show the new image instantly
    // We will save it when the user clicks "Save Changes"
    setFormData(prev => ({ ...prev, [fieldName]: newUrl }));
    
    toast({ title: "Upload Complete", description: "Image preview updated. Click 'Save Changes' to apply." });

    setUploadingAvatar(false);
    setUploadingBanner(false);
  };

  // 4. SAVE TEXT CHANGES
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({ title: "Error", description: "User not loaded yet. Please wait and try again.", variant: "destructive" });
      return;
    }

    const githubValid = validateGithubLink(formData.github_link);
    const linkedinValid = validateLinkedinLink(formData.linkedin_link);
    const bioValid = formData.bio.length <= 300;

    if (!githubValid || !linkedinValid || !bioValid) {
      toast({ title: "Validation Error", description: "Please fix the errors before saving", variant: "destructive" });
      return;
    }

    setSaving(true);

    // This upsert now saves EVERYTHING: text fields AND the new image URLs
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id, // This is why the user object is required
        username: formData.username,
        avatar_url: formData.avatar_url || null, // Now we save the new URL
        banner_url: formData.banner_url || null, // And this one too
        github_link: formData.github_link || null,
        linkedin_link: formData.linkedin_link || null,
        bio: formData.bio || null,
      });

    setSaving(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Profile saved successfully" });
    }
  };

  // 5. RENDER THE COMPONENT
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Edit Profile</h1>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl">
        
        <div className="relative mb-24">
          
          <div className="relative group">
            <div 
              className="h-48 w-full rounded-b-lg bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${formData.banner_url || ''})`, 
                backgroundColor: formData.banner_url ? 'transparent' : '#1f2937'
              }}
            />
            <div 
              className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={() => bannerInputRef.current?.click()}
            >
              {uploadingBanner ? (
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              ) : (
                <Camera className="h-8 w-8 text-white" />
              )}
            </div>
            <input 
              type="file" 
              ref={bannerInputRef} 
              className="hidden" 
              accept="image/png, image/jpeg, image/gif, video/mp4" 
              onChange={(e) => handleFileChange(e, 'banner')}
            />
          </div>

          <div className="absolute left-8 -bottom-16">
            <div className="relative group">
              <Avatar className="h-32 w-32 border-4 border-background rounded-full">
                <AvatarImage src={formData.avatar_url} />
                <AvatarFallback>
                  <UserIcon className="h-16 w-16" />
                </AvatarFallback>
              </Avatar>
              <div 
                className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => avatarInputRef.current?.click()}
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </div>
              <input 
                type="file" 
                ref={avatarInputRef} 
                className="hidden" 
                accept="image/png, image/jpeg, image/gif" 
                onChange={(e) => handleFileChange(e, 'avatar')}
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-4 pb-8">
          
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
              maxLength={300}
              className={errors.bio ? "border-destructive" : ""}
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                {formData.bio.length}/300 characters
              </p>
              {errors.bio && (
                <p className="text-xs text-destructive">{errors.bio}</p>
              )}
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={saving || Object.values(errors).some(e => e !== "")}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/")}>
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default Profile;