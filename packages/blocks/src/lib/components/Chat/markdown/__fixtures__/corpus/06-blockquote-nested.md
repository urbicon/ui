# On premature abstraction

There is an old piece of advice that keeps proving itself:

> Duplication is far cheaper than the wrong abstraction.
>
> When you feel the pull to extract a shared helper, ask first whether the two
> call sites are the same *by coincidence* or the same *by nature*. Only the
> latter earns an abstraction.

It is worth sitting with the nested case too, because critiques compound:

> The author is right, but I would add a caveat:
>
> > "The wrong abstraction" assumes you can tell which one is wrong up front.
> > Often you cannot, and the honest move is to inline it back the moment the
> > second requirement diverges.

So: copy first, extract on the third occurrence, and never feel bad about
un-abstracting when the shape stops holding.
