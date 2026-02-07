import { useState, useEffect } from "react";
import { Instagram, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface InstagramPost {
  id: string;
  instagram_id: string;
  media_type: string | null;
  media_url: string;
  thumbnail_url: string | null;
  permalink: string | null;
  caption: string | null;
}

const fallbackPosts = [
  { id: "1", image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=300&q=80" },
  { id: "2", image: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=300&q=80" },
  { id: "3", image: "https://images.unsplash.com/photo-1559302504-64aae6ca6b6d?w=300&q=80" },
  { id: "4", image: "https://images.unsplash.com/photo-1624397640148-949b1732bb0a?w=300&q=80" },
  { id: "5", image: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=300&q=80" },
  { id: "6", image: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=300&q=80" },
];

const INSTAGRAM_URL = "https://www.instagram.com/maismaisenergiasolaroficial/";

export function InstagramSection() {
  const { ref, isVisible } = useScrollReveal();
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [username] = useState("maismaisenergiasolaroficial");

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const { data: postsData, error: postsError } = await supabase
        .from("instagram_posts")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(6);

      if (postsError) throw postsError;
      if (postsData && postsData.length > 0) {
        setPosts(postsData);
      }
    } catch (error) {
      console.error("Error fetching Instagram posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (post: InstagramPost) => {
    if (post.media_type === "VIDEO" && post.thumbnail_url) return post.thumbnail_url;
    return post.media_url;
  };

  const instagramProfileUrl = `https://www.instagram.com/${username}/`;

  const renderPosts = (items: { id: string; image?: string; post?: InstagramPost }[]) => (
    items.map((item, i) => (
      <motion.a
        key={item.id}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={isVisible ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
        href={item.post?.permalink || instagramProfileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative rounded-xl overflow-hidden aspect-square"
      >
        <img
          src={item.post ? getImageUrl(item.post) : item.image}
          alt="Instagram post"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors duration-300 flex items-center justify-center">
          <Instagram className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300" />
        </div>
      </motion.a>
    ))
  );

  return (
    <section id="instagram" className="py-20 sm:py-32 bg-background relative overflow-hidden">
      <div ref={ref} className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary/10 text-secondary text-sm font-semibold mb-4">
            <Instagram className="w-4 h-4" />
            Instagram
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground mb-4 tracking-tight">
            Nosso Instagram
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-6">
            Confira nosso Instagram e acompanhe nossos projetos!
          </p>
          <Button asChild className="bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-full">
            <a href={instagramProfileUrl} target="_blank" rel="noopener noreferrer" className="gap-2">
              <Instagram className="w-4 h-4" />
              @{username}
              <ExternalLink className="w-3 h-3" />
            </a>
          </Button>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 max-w-5xl mx-auto">
          {posts.length > 0
            ? renderPosts(posts.map(p => ({ id: p.id, post: p })))
            : renderPosts(fallbackPosts.map(p => ({ id: p.id, image: p.image })))
          }
        </div>
      </div>
    </section>
  );
}
